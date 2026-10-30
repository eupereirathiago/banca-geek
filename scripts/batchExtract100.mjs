import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const DATA_COVERS = path.resolve('data/covers');
const PUBLIC_COVERS = path.resolve('public/covers');
fs.mkdirSync(DATA_COVERS, { recursive: true });
fs.mkdirSync(PUBLIC_COVERS, { recursive: true });

const rawEditions = JSON.parse(fs.readFileSync('src/data/repoEditions.json', 'utf8'));

function hasCover(id) {
  const dataPath = path.join(DATA_COVERS, `${id}.jpg`);
  const pubPath = path.join(PUBLIC_COVERS, `${id}.jpg`);
  const hasD = fs.existsSync(dataPath) && fs.statSync(dataPath).size > 1000;
  const hasP = fs.existsSync(pubPath) && fs.statSync(pubPath).size > 1000;
  if (hasD && !hasP) {
    try { fs.copyFileSync(dataPath, pubPath); } catch {}
    return true;
  }
  if (hasP && !hasD) {
    try { fs.copyFileSync(pubPath, dataPath); } catch {}
    return true;
  }
  return hasD && hasP;
}

function extractOne(id) {
  return new Promise((resolve) => {
    const child = spawn('node', ['scripts/workerExtract.mjs', id], { stdio: 'ignore' });
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch {}
      resolve(false);
    }, 25000);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve(code === 0);
    });
    child.on('error', () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}

export async function extractBatch(batchSize = 100, concurrency = 5, onProgress = null) {
  const missing = rawEditions.filter((e) => !hasCover(e.id));
  const targetBatch = missing.slice(0, batchSize);
  console.log(`[Batch 100] Extraindo lote de ${targetBatch.length} capas da Página 1 (Faltam no total: ${missing.length})...`);

  let successCount = 0;
  let failedCount = 0;

  for (let i = 0; i < targetBatch.length; i += concurrency) {
    const chunk = targetBatch.slice(i, i + concurrency);
    const results = await Promise.all(
      chunk.map(async (comic) => {
        const ok = await extractOne(comic.id);
        return { id: comic.id, title: comic.title, ok };
      })
    );

    for (const r of results) {
      if (r.ok) successCount++;
      else failedCount++;
    }

    const processed = successCount + failedCount;
    if (onProgress) {
      onProgress({ processed, total: targetBatch.length, success: successCount, failed: failedCount });
    }
    console.log(`[Batch Progresso] ${processed}/${targetBatch.length} | Sucesso: ${successCount} | Falha: ${failedCount} | Total no app: ${fs.readdirSync(PUBLIC_COVERS).length}`);
  }

  const currentTotal = fs.readdirSync(PUBLIC_COVERS).length;
  console.log(`[Batch Concluído] ${successCount} novas capas da Página 1 colhidas. Total atual em public/covers: ${currentTotal}/${rawEditions.length}`);
  return {
    processed: targetBatch.length,
    success: successCount,
    failed: failedCount,
    totalCovers: currentTotal,
    catalogTotal: rawEditions.length,
    remainingMissing: missing.length - successCount,
  };
}

// Run CLI directly if executed from command line
if (process.argv[1] && process.argv[1].endsWith('batchExtract100.mjs')) {
  const count = parseInt(process.argv[2], 10) || 100;
  extractBatch(count).then((res) => {
    console.log('Resultado do lote:', JSON.stringify(res, null, 2));
    process.exit(0);
  }).catch((err) => {
    console.error('Erro no lote:', err);
    process.exit(1);
  });
}
