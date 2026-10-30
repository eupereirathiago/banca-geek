import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import AdmZip from 'adm-zip';
import unrar from 'node-unrar-js';

const comicId = process.argv[2];
if (!comicId) process.exit(1);

const DATA_COVERS = path.resolve('data/covers');
const PUBLIC_COVERS = path.resolve('public/covers');
const rawEditions = JSON.parse(fs.readFileSync('src/data/repoEditions.json', 'utf8'));
const comic = rawEditions.find((e) => e.id === comicId);
if (!comic) process.exit(1);

const dataPath = path.join(DATA_COVERS, `${comic.id}.jpg`);
const pubPath = path.join(PUBLIC_COVERS, `${comic.id}.jpg`);

if (fs.existsSync(dataPath) && fs.statSync(dataPath).size > 1000) {
  if (!fs.existsSync(pubPath)) {
    try { fs.copyFileSync(dataPath, pubPath); } catch {}
  }
  process.exit(0);
}

const driveFileId = comic.driveFileId;
if (!driveFileId) process.exit(1);

const ext = (comic.format || (comic.isPdf ? 'pdf' : 'cbr')).toLowerCase();

async function run() {
  // 1. PDF via CDN
  if (comic.isPdf || ext === 'pdf') {
    try {
      const cdnUrl = `https://lh3.googleusercontent.com/d/${driveFileId}=w600`;
      const res = await fetch(cdnUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (res.ok && res.headers.get('content-type')?.includes('image')) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 500) {
          fs.writeFileSync(dataPath, buf);
          fs.writeFileSync(pubPath, buf);
          process.exit(0);
        }
      }
    } catch {}
  }

  // 2. Download from Google Drive with 12s timeout
  const downloadUrls = [
    `https://drive.usercontent.google.com/download?id=${driveFileId}&export=download&confirm=t`,
    `https://docs.google.com/uc?export=download&id=${driveFileId}`,
  ];

  let fileBuf = null;
  for (const url of downloadUrls) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0' } });
      clearTimeout(timer);
      if (res.ok) {
        const ab = await res.arrayBuffer();
        if (ab.byteLength > 1000) {
          fileBuf = Buffer.from(ab);
          break;
        }
      }
    } catch {}
  }

  if (!fileBuf || fileBuf.length < 1000) process.exit(1);

  let coverBuf = null;
  const isZip = fileBuf[0] === 0x50 && fileBuf[1] === 0x4b;
  const isRar = fileBuf[0] === 0x52 && fileBuf[1] === 0x61 && fileBuf[2] === 0x72;

  // A. RAR
  if (isRar || ext === 'cbr' || ext === 'rar') {
    try {
      const arrayBuf = fileBuf.buffer.slice(fileBuf.byteOffset, fileBuf.byteOffset + fileBuf.byteLength);
      const extractor = await unrar.createExtractorFromData({ data: arrayBuf });
      const list = extractor.getFileList();
      const imgHeaders = [...list.fileHeaders]
        .filter((h) => !h.flags.directory && /\.(jpe?g|png|webp|gif|bmp)$/i.test(h.name) && !h.name.includes('__MACOSX'))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
      if (imgHeaders.length > 0) {
        const extRes = extractor.extract({ files: [imgHeaders[0].name] });
        const files = [...extRes.files];
        if (files[0]?.extraction) coverBuf = Buffer.from(files[0].extraction);
      }
    } catch {}
  }

  // B. ZIP
  if (!coverBuf && (isZip || ext === 'cbz' || ext === 'zip' || ext === 'epub' || !isRar)) {
    try {
      const zip = new AdmZip(fileBuf);
      const entries = zip.getEntries();
      const imgEntries = entries
        .filter((e) => !e.isDirectory && /\.(jpe?g|png|webp|gif|bmp)$/i.test(e.entryName) && !e.entryName.includes('__MACOSX'))
        .sort((a, b) => a.entryName.localeCompare(b.entryName, undefined, { numeric: true, sensitivity: 'base' }));
      if (imgEntries.length > 0) coverBuf = imgEntries[0].getData();
    } catch {}
  }

  // C. Fallback RAR
  if (!coverBuf && !isRar) {
    try {
      const arrayBuf = fileBuf.buffer.slice(fileBuf.byteOffset, fileBuf.byteOffset + fileBuf.byteLength);
      const extractor = await unrar.createExtractorFromData({ data: arrayBuf });
      const list = extractor.getFileList();
      const imgHeaders = [...list.fileHeaders]
        .filter((h) => !h.flags.directory && /\.(jpe?g|png|webp|gif|bmp)$/i.test(h.name) && !h.name.includes('__MACOSX'))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
      if (imgHeaders.length > 0) {
        const extRes = extractor.extract({ files: [imgHeaders[0].name] });
        const files = [...extRes.files];
        if (files[0]?.extraction) coverBuf = Buffer.from(files[0].extraction);
      }
    } catch {}
  }

  // D. PDF Page 1 Ghostscript extraction
  if (!coverBuf && (isPdf || ext === 'pdf')) {
    try {
      const tmpPdf = `/tmp/pdf_${comicId}.pdf`;
      const tmpOut = `/tmp/cover_${comicId}.jpg`;
      fs.writeFileSync(tmpPdf, fileBuf);
      execSync(`gs -dNOPAUSE -dBATCH -dFirstPage=1 -dLastPage=1 -sDEVICE=jpeg -dJPEGQ=92 -r150 -sOutputFile="${tmpOut}" "${tmpPdf}" >/dev/null 2>&1`);
      if (fs.existsSync(tmpOut) && fs.statSync(tmpOut).size > 500) {
        coverBuf = fs.readFileSync(tmpOut);
        try { fs.unlinkSync(tmpOut); } catch {}
      }
      try { fs.unlinkSync(tmpPdf); } catch {}
    } catch {}
  }

  // E. Google CDN thumbnail fallback
  if (!coverBuf && driveFileId) {
    try {
      const thumbUrls = [
        `https://lh3.googleusercontent.com/d/${driveFileId}=w600`,
        `https://drive.google.com/thumbnail?id=${driveFileId}&sz=w600`,
      ];
      for (const tUrl of thumbUrls) {
        const tResp = await fetch(tUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (tResp.ok && tResp.headers.get('content-type')?.includes('image')) {
          const tBuf = Buffer.from(await tResp.arrayBuffer());
          if (tBuf.length > 500) {
            coverBuf = tBuf;
            break;
          }
        }
      }
    } catch {}
  }

  if (coverBuf && coverBuf.length > 500) {
    fs.writeFileSync(dataPath, coverBuf);
    fs.writeFileSync(pubPath, coverBuf);

    // Generate low-quality thumbnail (LQIP ~900 bytes) for instant offline preloading
    try {
      const lqipPath = path.join(DATA_COVERS, `${comic.id}.lqip`);
      execSync(`convert "${pubPath}" -resize 36x54 -quality 28 -strip "${lqipPath}" >/dev/null 2>&1`);
    } catch {}

    process.exit(0);
  }

  process.exit(1);
}

run().catch(() => process.exit(1));
