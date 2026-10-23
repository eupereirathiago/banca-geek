import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import unrar from 'node-unrar-js';

const COVERS_DIR = path.resolve('data/covers');
if (!fs.existsSync(COVERS_DIR)) {
  fs.mkdirSync(COVERS_DIR, { recursive: true });
}

const rawData = JSON.parse(fs.readFileSync('src/data/repoEditions.json', 'utf8'));

// Filter for Thanos/Infinito, Pulse, and first 40 PDFs
const homeComics = rawData.filter(
  (c) =>
    c.title.toLowerCase().includes('thanos') ||
    c.title.toLowerCase().includes('infinit') ||
    c.title.toLowerCase().includes('pulse') ||
    c.title.toLowerCase().includes('surfe') ||
    c.title.toLowerCase().includes('vingadores')
).slice(0, 60);

console.log(`Extracting covers for ${homeComics.length} home carousel comics...`);

async function extractOne(comic) {
  const coverPath = path.join(COVERS_DIR, `${comic.id}.jpg`);
  if (fs.existsSync(coverPath) && fs.statSync(coverPath).size > 1000) {
    return true;
  }

  const driveFileId = comic.driveFileId;
  if (!driveFileId) return false;

  const ext = (comic.format || 'cbr').toLowerCase();

  // 1. If PDF, try CDN
  if (comic.isPdf || ext === 'pdf') {
    try {
      const cdnUrl = `https://lh3.googleusercontent.com/d/${driveFileId}=w600`;
      const res = await fetch(cdnUrl);
      if (res.ok && res.headers.get('content-type')?.includes('image')) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 500) {
          fs.writeFileSync(coverPath, buf);
          console.log(`[PDF] Extracted cover for: ${comic.title.slice(0, 30)}`);
          return true;
        }
      }
    } catch {}
  }

  const downloadUrl = `https://drive.usercontent.google.com/download?id=${driveFileId}&export=download&confirm=t`;

  // 2. If CBZ or ZIP
  if (ext === 'cbz' || ext === 'zip') {
    try {
      const res = await fetch(downloadUrl);
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuf);
        const imgFiles = Object.keys(zip.files).filter((k) => /\.(jpe?g|png|webp)$/i.test(k));
        imgFiles.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        if (imgFiles.length > 0) {
          const imgBuf = await zip.files[imgFiles[0]].async('nodebuffer');
          fs.writeFileSync(coverPath, imgBuf);
          console.log(`[CBZ] Extracted cover for: ${comic.title.slice(0, 30)}`);
          return true;
        }
      }
    } catch {}
  }

  // 3. If CBR or RAR
  if (ext === 'cbr' || ext === 'rar') {
    try {
      const res = await fetch(downloadUrl);
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        const extractor = await unrar.createExtractorFromData({ data: arrayBuf });
        const list = extractor.getFileList();
        const headers = [...list.fileHeaders].filter((h) => /\.(jpe?g|png|webp)$/i.test(h.name));
        headers.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        if (headers.length > 0) {
          const extracted = extractor.extract({ files: [headers[0].name] });
          const files = [...extracted.files];
          if (files[0]?.extraction) {
            fs.writeFileSync(coverPath, Buffer.from(files[0].extraction));
            console.log(`[CBR] Extracted cover for: ${comic.title.slice(0, 30)}`);
            return true;
          }
        }
      }
    } catch {}
  }

  return false;
}

async function run() {
  let count = 0;
  for (const c of homeComics) {
    try {
      const ok = await extractOne(c);
      if (ok) count++;
    } catch {}
  }
  console.log(`Finished home carousel extraction! Total now in data/covers: ${fs.readdirSync(COVERS_DIR).length}`);
}

run();
