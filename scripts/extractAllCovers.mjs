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

function runWorkerForComic(comicId) {
  return new Promise((resolve) => {
    const child = spawn('node', ['scripts/workerExtract.mjs', comicId], {
      stdio: 'ignore',
    });
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch {}
      resolve(false);
    }, 20000);
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

async function main() {
  const missing = rawEditions.filter((e) => !hasCover(e.id));
  console.log(`[Super Robust Extractor] Faltam processar ${missing.length} capas.`);

  const concurrency = 6;
  let success = 0;
  let failed = 0;

  for (let i = 0; i < missing.length; i += concurrency) {
    const batch = missing.slice(i, i + concurrency);
    const results = await Promise.all(batch.map((c) => runWorkerForComic(c.id)));
    for (const ok of results) {
      if (ok) success++;
      else failed++;
    }
    const processed = success + failed;
    if (processed % 30 === 0 || processed >= missing.length) {
      console.log(`[Progresso] ${processed}/${missing.length} | Sucesso: ${success} | Total em public/covers: ${fs.readdirSync(PUBLIC_COVERS).length}`);
    }
  }

  console.log(`[Concluído] Sucesso: ${success}, Falha: ${failed}`);
  console.log(`Total final de capas: ${fs.readdirSync(PUBLIC_COVERS).length}`);
}

main().catch(console.error);
