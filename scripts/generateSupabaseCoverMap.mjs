import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const client = createClient(
  process.env.SUPABASE_URL || 'https://urnxozvpirwotccsxwgu.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function run() {
  console.log('[Supabase Cover Map] Buscando arquivos do bucket comic-covers...');
  let allCoverFiles = [];
  let offset = 0;
  while (true) {
    const { data, error } = await client.storage.from('comic-covers').list('covers', { limit: 1000, offset });
    if (error) {
      console.error('Erro ao listar bucket:', error);
      break;
    }
    if (!data || data.length === 0) break;
    allCoverFiles.push(...data);
    if (data.length < 1000) break;
    offset += data.length;
  }
  console.log(`[Supabase Cover Map] Total de capas no bucket: ${allCoverFiles.length}`);

  const coverNames = allCoverFiles.map((f) => f.name);

  function cleanPt(s) {
    if (!s) return '';
    return s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/_([aeiou])_/gi, '$1')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  const normMap = new Map();
  for (const name of coverNames) {
    normMap.set(cleanPt(name.replace(/\.webp$/i, '')), name);
  }

  const repo = JSON.parse(fs.readFileSync('src/data/repoEditions.json', 'utf8'));

  const coverMap = {};
  let directMatches = 0;

  for (const ed of repo) {
    const rawClean = cleanPt((ed.rawFileName || '').replace(/\.[a-z0-9]+$/i, ''));
    const titleClean = cleanPt(ed.title || '');

    if (normMap.has(rawClean)) {
      coverMap[ed.id] = `covers/${normMap.get(rawClean)}`;
      directMatches++;
    } else if (normMap.has(titleClean)) {
      coverMap[ed.id] = `covers/${normMap.get(titleClean)}`;
      directMatches++;
    } else {
      // Check if comic.id directly exists
      if (coverNames.includes(`${ed.id}.webp`)) {
        coverMap[ed.id] = `covers/${ed.id}.webp`;
        directMatches++;
      } else if (coverNames.includes(`${ed.id}.jpg`)) {
        coverMap[ed.id] = `covers/${ed.id}.jpg`;
        directMatches++;
      }
    }
  }

  // Also include all cover names as a lookup dictionary by clean name so dynamic / user-added comics match instantly
  const cleanToPath = {};
  for (const name of coverNames) {
    cleanToPath[cleanPt(name.replace(/\.webp$/i, ''))] = `covers/${name}`;
  }

  const outputData = {
    generatedAt: new Date().toISOString(),
    bucket: 'comic-covers',
    projectId: 'urnxozvpirwotccsxwgu',
    totalBucketCovers: coverNames.length,
    matchedEditionsCount: directMatches,
    editionsMap: coverMap,
    cleanNameMap: cleanToPath,
  };

  fs.writeFileSync('src/data/supabaseCoverMap.json', JSON.stringify(outputData, null, 2), 'utf8');
  console.log(`[Supabase Cover Map] Salvo src/data/supabaseCoverMap.json com ${directMatches} edições mapeadas!`);
}

run();
