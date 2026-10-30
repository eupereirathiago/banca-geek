import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const DATA_COVERS = path.resolve('data/covers');
const PUBLIC_COVERS = path.resolve('public/covers');
const DB_PATH = path.resolve('data/banca_geek_database.json');
const BUNDLE_PATH = path.resolve('data/covers_lqip_bundle.json');

fs.mkdirSync(DATA_COVERS, { recursive: true });
fs.mkdirSync(PUBLIC_COVERS, { recursive: true });

const rawEditions = JSON.parse(fs.readFileSync('src/data/repoEditions.json', 'utf8'));

// Load database
let db = { covers: {} };
if (fs.existsSync(DB_PATH)) {
  try {
    db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    db.covers = db.covers || {};
  } catch {}
}

const bundleMap = {};

function getFallbackSvgDataUrl(comic) {
  const title = (comic.title || 'HQ').slice(0, 22).replace(/[<>&"]/g, '');
  const pub = (comic.publisher || 'Marvel').toUpperCase();
  const year = comic.year || 1990;
  const num = comic.issueNumber || 1;
  const isAbril = title.toLowerCase().includes('abril');
  const bg = isAbril ? '#1a0933' : '#12121f';
  const accent = isAbril ? '#ffc531' : '#d62839';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="54" viewBox="0 0 36 54">
    <rect width="36" height="54" fill="${bg}"/>
    <rect x="1" y="1" width="34" height="6" fill="${accent}"/>
    <rect x="2" y="10" width="10" height="8" fill="#ffc531"/>
    <text x="7" y="16" font-family="sans-serif" font-size="5" font-weight="bold" fill="#12121f" text-anchor="middle">#${num}</text>
    <text x="18" y="32" font-family="sans-serif" font-size="4" font-weight="bold" fill="#f4ebd8" text-anchor="middle">${title.slice(0, 10)}</text>
    <text x="18" y="48" font-family="sans-serif" font-size="3" fill="#8a8ca5" text-anchor="middle">${year}</text>
  </svg>`.replace(/\s+/g, ' ');

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

console.log(`[LQIP Generator] Processando miniaturas de baixa qualidade para ${rawEditions.length} edições...`);

let realCoverCount = 0;
let fallbackCount = 0;

for (const comic of rawEditions) {
  const pubPath = path.join(PUBLIC_COVERS, `${comic.id}.jpg`);
  const dataPath = path.join(DATA_COVERS, `${comic.id}.jpg`);
  const lqipPath = path.join(DATA_COVERS, `${comic.id}.lqip`);

  const hasImage = (fs.existsSync(pubPath) && fs.statSync(pubPath).size > 500)
    || (fs.existsSync(dataPath) && fs.statSync(dataPath).size > 500);

  if (hasImage) {
    const srcPath = fs.existsSync(pubPath) ? pubPath : dataPath;

    // Generate .lqip file if missing or empty
    if (!fs.existsSync(lqipPath) || fs.statSync(lqipPath).size < 100) {
      try {
        execSync(`convert "${srcPath}" -resize 36x54 -quality 28 -strip "${lqipPath}" >/dev/null 2>&1`);
      } catch {}
    }

    if (fs.existsSync(lqipPath) && fs.statSync(lqipPath).size > 100) {
      const buf = fs.readFileSync(lqipPath);
      const dataUrl = `data:image/jpeg;base64,${buf.toString('base64')}`;
      bundleMap[comic.id] = dataUrl;

      db.covers[comic.id] = db.covers[comic.id] || {
        comicId: comic.id,
        mimeType: 'image/jpeg',
        coverPath: srcPath,
        extractedAt: new Date().toISOString(),
        totalPages: comic.totalPages || 32,
        title: comic.title,
      };
      db.covers[comic.id].lqip = dataUrl;
      realCoverCount++;
      continue;
    }
  }

  // Fallback themed micro-placeholder for comics not yet extracted in high-res
  const svgDataUrl = getFallbackSvgDataUrl(comic);
  bundleMap[comic.id] = svgDataUrl;
  db.covers[comic.id] = db.covers[comic.id] || {
    comicId: comic.id,
    mimeType: 'image/svg+xml',
    extractedAt: new Date().toISOString(),
    totalPages: comic.totalPages || 32,
    title: comic.title,
  };
  db.covers[comic.id].lqip = svgDataUrl;
  fallbackCount++;
}

// Save bundle JSON and database JSON
fs.writeFileSync(BUNDLE_PATH, JSON.stringify(bundleMap));
fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));

console.log(`[LQIP Concluído] ${Object.keys(bundleMap).length} miniaturas no pacote.`);
console.log(`- Capas reais Página 1: ${realCoverCount}`);
console.log(`- Placeholders estilizados: ${fallbackCount}`);
console.log(`Tamanho do pacote bundle: ${(fs.statSync(BUNDLE_PATH).size / 1024).toFixed(1)} KB`);
