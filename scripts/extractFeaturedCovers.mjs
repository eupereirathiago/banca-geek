import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import unrar from 'node-unrar-js';

const COVERS_DIR = path.resolve('data/covers');
if (!fs.existsSync(COVERS_DIR)) {
  fs.mkdirSync(COVERS_DIR, { recursive: true });
}

const rawData = JSON.parse(fs.readFileSync('src/data/repoEditions.json', 'utf8'));

// Focus on the top prominent sagas on the homepage
const targetComics = rawData.slice(0, 50);

console.log(`Starting cover pre-extraction for ${targetComics.length} comics...`);

async function extractOne(comic) {
  const coverPath = path.join(COVERS_DIR, `${comic.id}.jpg`);
  if (fs.existsSync(coverPath) && fs.statSync(coverPath).size > 1000) {
    return true;
  }

  const driveFileId = comic.driveFileId;
  if (!driveFileId) return false;

  const ext = (comic.format || 'cbr').toLowerCase();

  // If PDF, fetch directly from high-speed image CDN
  if (comic.isPdf || ext === 'pdf') {
    try {
      const cdnUrl = `https://lh3.googleusercontent.com/d/${driveFileId}=w600`;
      const res = await fetch(cdnUrl);
      if (res.ok && res.headers.get('content-type')?.includes('image')) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 500) {
          fs.writeFileSync(coverPath, buf);
          console.log(`[PDF] Extracted cover for: ${comic.title.slice(0, 30)} (${buf.length} bytes)`);
          return true;
        }
      }
    } catch {}
  }

  // If CBZ or ZIP
  if (ext === 'cbz' || ext === 'zip') {
    try {
      const url = `https://drive.usercontent.google.com/download?id=${driveFileId}&export=download&confirm=t`;
      const res = await fetch(url);
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuf);
        const imgFiles = Object.keys(zip.files).filter((k) => /\.(jpe?g|png|webp)$/i.test(k));
        imgFiles.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        if (imgFiles.length > 0) {
          const imgBuf = await zip.files[imgFiles[0]].async('nodebuffer');
          fs.writeFileSync(coverPath, imgBuf);
          console.log(`[CBZ] Extracted cover for: ${comic.title.slice(0, 30)} (${imgBuf.length} bytes)`);
          return true;
        }
      }
    } catch {}
  }

  // If CBR or RAR
  if (ext === 'cbr' || ext === 'rar') {
    try {
      const url = `https://drive.usercontent.google.com/download?id=${driveFileId}&export=download&confirm=t`;
      const res = await fetch(url);
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
            console.log(`[CBR] Extracted cover for: ${comic.title.slice(0, 30)} (${files[0].extraction.length} bytes)`);
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
  for (const c of targetComics) {
    try {
      const ok = await extractOne(c);
      if (ok) count++;
    } catch (e) {
      console.warn(`Failed for ${c.title.slice(0, 20)}:`, e.message);
    }
  }
  console.log(`Finished pre-extracting ${count} covers!`);
}

run();
