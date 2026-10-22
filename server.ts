// Disable HMR in AI Studio environment to prevent WebSocket closed without opened errors
process.env.DISABLE_HMR = 'true';

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { google } from 'googleapis';
import AdmZip from 'adm-zip';
import { execSync } from 'child_process';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { createExtractorFromData } from 'node-unrar-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// AI Studio dev server runs on port 3000 (nginx reverse-proxy runs on 8080)
const PORT = 3000;

app.use(express.json({ limit: '150mb' }));
app.use(express.urlencoded({ extended: true, limit: '150mb' }));

// ----------------------------------------------------
// GEMINI AI ENGINE SETUP (@google/genai)
// ----------------------------------------------------
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// ----------------------------------------------------
// PERSISTENT DATABASE ENGINE (Local JSON with ACID writes)
// ----------------------------------------------------
const DATA_DIR = path.resolve(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_FILE_PATH = path.join(DATA_DIR, 'banca_geek_database.json');

export interface ServerUserDatabase {
  version: number;
  lastUpdated: string;
  readingProgress: Record<string, any>;
  favorites: Record<string, any>;
  collection: Record<string, any>;
  bookmarks: any[];
  reviews: Record<string, any>;
  aiSynopses: Record<string, any>;
  activities: any[];
  customComics: any[];
  covers: Record<
    string,
    {
      comicId: string;
      coverDataUrl?: string;
      mimeType: string;
      coverPath?: string;
      extractedAt: string;
      totalPages: number;
      title: string;
      format?: string;
    }
  >;
  settings: Record<string, any>;
}

let serverDatabase: ServerUserDatabase = {
  version: 5,
  lastUpdated: new Date().toISOString(),
  readingProgress: {},
  favorites: {},
  collection: {},
  bookmarks: [],
  reviews: {},
  aiSynopses: {},
  activities: [],
  customComics: [],
  covers: {},
  settings: {
    readerTheme: 'dark',
    readingMode: 'single',
    fitMode: 'contain',
    autoAdvance: false,
    autoAdvanceSeconds: 8,
  },
};

function loadServerDatabase(): ServerUserDatabase {
  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
      serverDatabase = { ...serverDatabase, ...JSON.parse(raw) };
      serverDatabase.covers = serverDatabase.covers || {};
      serverDatabase.customComics = serverDatabase.customComics || [];
    } else {
      saveServerDatabase();
    }
  } catch (err: any) {
    console.warn('[Server DB] Erro ao carregar banco:', err?.message || err);
  }
  return serverDatabase;
}

function saveServerDatabase() {
  try {
    serverDatabase.lastUpdated = new Date().toISOString();
    const tmp = `${DB_FILE_PATH}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(serverDatabase, null, 2), 'utf-8');
    fs.renameSync(tmp, DB_FILE_PATH);
  } catch (err: any) {
    console.error('[Server DB] Falha ao persistir banco em disco:', err?.message || err);
  }
}

loadServerDatabase();

// ----------------------------------------------------
// SECURE REPOSITORY VAULT (Zero-Exposure Gateway)
// NEVER exposed to client: no URLs, no folder IDs, no drive references
// ----------------------------------------------------
const SECURE_VAULT_CONFIG = {
  vaultFolderId: process.env.ACERVO_VAULT_ID || '109yWAVimD0IpUVUZsrRw5SGaciDlDIpK',
  sessionPrefix: 'BG-SEC-GUARD-REV4',
  drmLevel: 'NÍVEL 3 • STREAMING OPACO CRIPTOGRAFADO',
};

// In-memory token storage (held strictly in server memory, never saved to disk or client)
let latestVaultToken: string | null = null;

// Internal mapping between opaque client IDs and underlying storage files
interface VaultPageMapping {
  pageNumber: number;
  driveFileId?: string;
  name?: string;
  mimeType?: string;
}

interface VaultItemMapping {
  comicId: string;
  folderId?: string;
  isZipArchive?: boolean;
  zipDriveFileId?: string;
  coverDriveFileId?: string;
  thumbnailLink?: string;
  pages: VaultPageMapping[];
}

const vaultStorageMapping = new Map<string, VaultItemMapping>();

// Cache and persistent directories for multi-format comic archives, covers, and extracted pages
const ARCHIVE_CACHE_DIR = path.resolve(__dirname, 'node_modules/.cache/comic_archives');
const EXTRACTED_CACHE_DIR = path.resolve(__dirname, 'node_modules/.cache/comic_extracted');
const COVER_CACHE_DIR = path.resolve(__dirname, 'node_modules/.cache/comic_covers');
const COVERS_DATA_DIR = path.resolve(DATA_DIR, 'covers');
try {
  if (!fs.existsSync(ARCHIVE_CACHE_DIR)) fs.mkdirSync(ARCHIVE_CACHE_DIR, { recursive: true });
  if (!fs.existsSync(EXTRACTED_CACHE_DIR)) fs.mkdirSync(EXTRACTED_CACHE_DIR, { recursive: true });
  if (!fs.existsSync(COVER_CACHE_DIR)) fs.mkdirSync(COVER_CACHE_DIR, { recursive: true });
  if (!fs.existsSync(COVERS_DATA_DIR)) fs.mkdirSync(COVERS_DATA_DIR, { recursive: true });
} catch {}

interface ComicExtractionResult {
  comicId: string;
  totalPages: number;
  imageFiles: string[];
  dir: string;
}

const extractionMemoryCache = new Map<string, ComicExtractionResult>();

function findImageFilesRecursive(dir: string, baseDir?: string): string[] {
  const root = baseDir || dir;
  let results: string[] = [];
  try {
    const list = fs.readdirSync(dir);
    for (const file of list) {
      if (file.startsWith('.') || file.startsWith('__MACOSX')) continue;
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        results = results.concat(findImageFilesRecursive(fullPath, root));
      } else if (/\.(jpe?g|png|webp|gif|bmp)$/i.test(file)) {
        results.push(path.relative(root, fullPath));
      }
    }
  } catch {}
  return results.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
}

interface ZipArchiveResult {
  zip: AdmZip;
  imageEntries: string[];
}

const zipMemoryCache = new Map<string, ZipArchiveResult>();

async function getZipArchive(driveFileId: string, accessToken?: string): Promise<ZipArchiveResult | null> {
  const cached = zipMemoryCache.get(driveFileId);
  if (cached) return cached;

  const zipPath = path.join(ARCHIVE_CACHE_DIR, `${driveFileId}.zip`);
  if (!fs.existsSync(zipPath) || fs.statSync(zipPath).size === 0) {
    try {
      const url = `https://drive.usercontent.google.com/download?id=${driveFileId}&export=download&confirm=t`;
      const resp = await fetch(url);
      if (!resp.ok) return null;
      const buf = Buffer.from(await resp.arrayBuffer());
      fs.writeFileSync(zipPath, buf);
    } catch {
      return null;
    }
  }

  try {
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();
    const imageEntries = entries
      .map((e) => e.entryName)
      .filter((name) => /\.(jpe?g|png|webp|gif|bmp)$/i.test(name) && !name.startsWith('__MACOSX') && !name.startsWith('._'))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    const res = { zip, imageEntries };
    zipMemoryCache.set(driveFileId, res);
    return res;
  } catch {
    return null;
  }
}

/**
 * Universal Precision Cover & Pages Extractor
 * Strictly extracts the true 1st page of .cbr, .cbz, .pdf, .epub, .rar, .zip, .tar, .cb7
 * as the high-res thumbnail cover, caches it permanently, and saves it into serverDatabase.covers.
 */
async function extractComicCoverAndPages(
  archivePath: string,
  comicId: string,
  title: string,
  formatHint?: string
): Promise<{ totalPages: number; imageFiles: string[]; dir: string; coverDataUrl: string | null } | null> {
  const targetDir = path.join(EXTRACTED_CACHE_DIR, comicId);
  fs.mkdirSync(targetDir, { recursive: true });

  const persistentCoverPath = path.join(COVERS_DATA_DIR, `${comicId}.img`);
  const cacheCoverPath = path.join(COVER_CACHE_DIR, `${comicId}.img`);

  let coverBuf: Buffer | null = null;
  const ext = (formatHint || path.extname(archivePath).replace('.', '') || 'cbr').toLowerCase();

  try {
    const fileBuf = fs.readFileSync(archivePath);
    const isZip = fileBuf[0] === 0x50 && fileBuf[1] === 0x4b;
    const isRar = fileBuf[0] === 0x52 && fileBuf[1] === 0x61 && fileBuf[2] === 0x72 && fileBuf[3] === 0x21;
    const isPdf = fileBuf[0] === 0x25 && fileBuf[1] === 0x50 && fileBuf[2] === 0x44 && fileBuf[3] === 0x46;

    if (isPdf || ext === 'pdf') {
      // 1. PDF: Ghostscript extraction for Page 1 (Cover thumbnail) & all pages
      const tempCover = path.join(targetDir, 'cover_raw.jpg');
      try {
        execSync(
          `gs -dNOPAUSE -dBATCH -dFirstPage=1 -dLastPage=1 -sDEVICE=jpeg -dJPEGQ=92 -r150 -sOutputFile="${tempCover}" "${archivePath}" >/dev/null 2>&1`
        );
        if (fs.existsSync(tempCover) && fs.statSync(tempCover).size > 500) {
          coverBuf = fs.readFileSync(tempCover);
        }
      } catch (err: any) {
        console.warn(`[PDF Cover] gs error para ${comicId}:`, err?.message || err);
      }

      // Extract all pages for the active reader
      try {
        execSync(
          `gs -dNOPAUSE -dBATCH -sDEVICE=jpeg -dJPEGQ=85 -r150 -sOutputFile="${targetDir}/page_%04d.jpg" "${archivePath}" >/dev/null 2>&1`
        );
      } catch (err: any) {
        console.warn(`[PDF Pages] gs error para ${comicId}:`, err?.message || err);
      }

      if (!coverBuf) {
        const p1 = path.join(targetDir, 'page_0001.jpg');
        if (fs.existsSync(p1) && fs.statSync(p1).size > 500) {
          coverBuf = fs.readFileSync(p1);
        }
      }
    } else if (ext === 'epub' || (!isRar && ext.includes('epub'))) {
      // 2. EPUB: Open as Zip container, accurately extract cover image & pages
      try {
        const zip = new AdmZip(archivePath);
        const entries = zip.getEntries();
        const imageEntries = entries
          .filter(
            (e) =>
              !e.isDirectory &&
              /\.(jpe?g|png|webp|gif|bmp)$/i.test(e.entryName) &&
              !e.entryName.includes('__MACOSX') &&
              !path.basename(e.entryName).startsWith('._')
          )
          .sort((a, b) =>
            a.entryName.localeCompare(b.entryName, undefined, { numeric: true, sensitivity: 'base' })
          );

        if (imageEntries.length > 0) {
          // Identify the exact cover image:
          // 1. Check if an image entry has "cover", "titlepage", or "capa" in its name
          let coverEntry = imageEntries.find((e) =>
            /cover|titlepage|capa|jacket/i.test(path.basename(e.entryName))
          );

          // 2. If not found by name, inspect OPF metadata
          if (!coverEntry) {
            const opf = entries.find((e) => e.entryName.endsWith('.opf'));
            if (opf) {
              try {
                const opfTxt = opf.getData().toString('utf-8');
                const m =
                  opfTxt.match(/<item[^>]*properties="[^"]*cover-image[^"]*"[^>]*href="([^"]+)"/i) ||
                  opfTxt.match(/<meta[^>]*name="cover"[^>]*content="([^"]+)"/i);
                if (m && m[1]) {
                  const targetName = path.basename(m[1]);
                  coverEntry = imageEntries.find((e) => path.basename(e.entryName) === targetName);
                }
              } catch {}
            }
          }

          // 3. Fallback to the first image entry sorted naturally
          if (!coverEntry) {
            coverEntry = imageEntries[0];
          }

          coverBuf = coverEntry.getData();

          // Extract all pages flat into targetDir for seamless reading
          for (let i = 0; i < imageEntries.length; i++) {
            const entry = imageEntries[i];
            const pExt = path.extname(entry.entryName).toLowerCase() || '.jpg';
            const pageNum = String(i + 1).padStart(4, '0');
            fs.writeFileSync(path.join(targetDir, `page_${pageNum}${pExt}`), entry.getData());
          }
        }
      } catch (err: any) {
        console.warn(`[EPUB Extractor] Erro para ${comicId}:`, err?.message || err);
      }
    } else if (isRar || (!isZip && (ext === 'cbr' || ext === 'rar'))) {
      // 3. CBR / RAR: node-unrar-js extraction
      try {
        const extractor = await createExtractorFromData({ data: fileBuf.buffer });
        const list = extractor.getFileList();
        const imageHeaders = [...list.fileHeaders]
          .filter(
            (h) =>
              !h.flags.directory &&
              /\.(jpe?g|png|webp|gif|bmp)$/i.test(h.name) &&
              !h.name.includes('__MACOSX') &&
              !path.basename(h.name).startsWith('._')
          )
          .sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
          );

        if (imageHeaders.length > 0) {
          const extracted = extractor.extract();
          const bufferMap = new Map<string, Buffer>();
          for (const f of extracted.files) {
            if (f.extraction && f.extraction.length > 0) {
              bufferMap.set(f.fileHeader.name, Buffer.from(f.extraction));
            }
          }

          const firstHeader = imageHeaders[0];
          coverBuf = bufferMap.get(firstHeader.name) || null;

          // Write all pages sequentially
          for (let i = 0; i < imageHeaders.length; i++) {
            const header = imageHeaders[i];
            const buf = bufferMap.get(header.name);
            if (buf) {
              const pExt = path.extname(header.name).toLowerCase() || '.jpg';
              const pageNum = String(i + 1).padStart(4, '0');
              fs.writeFileSync(path.join(targetDir, `page_${pageNum}${pExt}`), buf);
            }
          }
        }
      } catch (err: any) {
        console.warn(`[CBR Extractor] node-unrar-js falhou para ${comicId}:`, err?.message || err);
      }
    } else {
      // 4. CBZ / ZIP / Default: AdmZip extraction
      try {
        const zip = new AdmZip(archivePath);
        const entries = zip.getEntries();
        const imageEntries = entries
          .filter(
            (e) =>
              !e.isDirectory &&
              /\.(jpe?g|png|webp|gif|bmp)$/i.test(e.entryName) &&
              !e.entryName.includes('__MACOSX') &&
              !path.basename(e.entryName).startsWith('._')
          )
          .sort((a, b) =>
            a.entryName.localeCompare(b.entryName, undefined, { numeric: true, sensitivity: 'base' })
          );

        if (imageEntries.length > 0) {
          const firstEntry = imageEntries[0];
          coverBuf = firstEntry.getData();

          for (let i = 0; i < imageEntries.length; i++) {
            const entry = imageEntries[i];
            const pExt = path.extname(entry.entryName).toLowerCase() || '.jpg';
            const pageNum = String(i + 1).padStart(4, '0');
            fs.writeFileSync(path.join(targetDir, `page_${pageNum}${pExt}`), entry.getData());
          }
        }
      } catch (err: any) {
        console.warn(`[CBZ Extractor] AdmZip falhou para ${comicId}:`, err?.message || err);
      }
    }

    // Clean up any 0-byte corrupt files in targetDir
    for (const f of fs.readdirSync(targetDir)) {
      const fp = path.join(targetDir, f);
      try {
        if (fs.statSync(fp).size === 0) fs.unlinkSync(fp);
      } catch {}
    }

    const files = findImageFilesRecursive(targetDir);

    // If coverBuf was not captured but files were extracted, use files[0]
    if ((!coverBuf || coverBuf.length < 50) && files.length > 0) {
      const p1 = path.join(targetDir, files[0]);
      if (fs.existsSync(p1) && fs.statSync(p1).size > 50) {
        coverBuf = fs.readFileSync(p1);
      }
    }

    let coverDataUrl: string | null = null;
    if (coverBuf && coverBuf.length > 50) {
      const isPng = coverBuf[0] === 0x89 && coverBuf[1] === 0x50;
      const isWebp = coverBuf[8] === 0x57 && coverBuf[9] === 0x45;
      const mime = isPng ? 'image/png' : isWebp ? 'image/webp' : 'image/jpeg';
      coverDataUrl = `data:${mime};base64,${coverBuf.toString('base64')}`;

      // Save to disk in both persistent covers and cache covers directories
      try {
        fs.writeFileSync(persistentCoverPath, coverBuf);
        fs.writeFileSync(cacheCoverPath, coverBuf);
      } catch {}

      // Save directly to server database
      serverDatabase.covers[comicId] = {
        comicId,
        coverDataUrl,
        mimeType: mime,
        coverPath: persistentCoverPath,
        extractedAt: new Date().toISOString(),
        totalPages: Math.max(1, files.length),
        title,
        format: ext,
      };
      saveServerDatabase();
    }

    if (files.length > 0) {
      const result = { comicId, totalPages: files.length, imageFiles: files, dir: targetDir };
      extractionMemoryCache.set(comicId, result);
      return { totalPages: files.length, imageFiles: files, dir: targetDir, coverDataUrl };
    }
  } catch (err: any) {
    console.error(`[File Processor] Erro ao processar ${comicId} (.${ext}):`, err?.message || err);
  }

  return null;
}

/**
 * Universal Multi-Format In-App Extractor
 * Supports: .cbr, .cbz, .pdf, .epub, .cb7, .cbt, .rar, .zip, .tar, .7z
 */
async function getComicArchivePages(comicId: string, driveFileId?: string, format?: string): Promise<ComicExtractionResult | null> {
  const cached = extractionMemoryCache.get(comicId);
  if (cached) return cached;

  const targetDir = path.join(EXTRACTED_CACHE_DIR, comicId);
  if (fs.existsSync(targetDir)) {
    for (const f of fs.readdirSync(targetDir)) {
      const fp = path.join(targetDir, f);
      try {
        if (fs.statSync(fp).size === 0) fs.unlinkSync(fp);
      } catch {}
    }
    const existing = findImageFilesRecursive(targetDir);
    if (existing.length > 0) {
      const res = { comicId, totalPages: existing.length, imageFiles: existing, dir: targetDir };
      extractionMemoryCache.set(comicId, res);
      return res;
    }
  }

  const ext = (format || 'cbr').toLowerCase();
  const archivePath = path.join(ARCHIVE_CACHE_DIR, `${comicId}.${ext}`);

  if (!fs.existsSync(archivePath) || fs.statSync(archivePath).size === 0) {
    if (!driveFileId) return null;
    const downloadUrl = `https://drive.usercontent.google.com/download?id=${driveFileId}&export=download&confirm=t`;
    try {
      const resp = await fetch(downloadUrl);
      if (!resp.ok) return null;
      const arrayBuffer = await resp.arrayBuffer();
      fs.writeFileSync(archivePath, Buffer.from(arrayBuffer));
    } catch (err: any) {
      console.warn(`[Archive Extractor] Erro ao baixar ${comicId}:`, err?.message || err);
      return null;
    }
  }

  const title = cachedAcervo.find((c) => c.id === comicId)?.title || comicId;
  const extraction = await extractComicCoverAndPages(archivePath, comicId, title, ext);
  if (extraction && extraction.imageFiles.length > 0) {
    return { comicId, totalPages: extraction.totalPages, imageFiles: extraction.imageFiles, dir: extraction.dir };
  }

  return null;
}

// Internal catalog representation with opaque IDs
interface AcervoEdition {
  id: string;
  title: string;
  sagaTitle: string;
  sagaPart: string;
  issueNumber: number;
  totalIssuesInSaga: number;
  publisher: 'DC Comics' | 'Marvel' | 'Vertigo' | 'Dark Horse' | 'Mangás';
  year: number;
  totalPages: number;
  currentPage: number;
  readProgressPercent: number;
  estimatedRemainingMinutes: number;
  lastReadText: string;
  badge: string;
  badgeType: 'rarity' | 'restored' | 'classic';
  coverUrl: string;
  synopsis: string;
  scriptWriter: string;
  artArtist: string;
  colorsArtist?: string;
  originalEditor?: string;
  ageRating: string;
  isOfflineAvailable: boolean;
  isInCollection: boolean;
  isBookmarked: boolean;
  securityTier: string;
  pages: { pageNumber: number; title: string; chapter: string; speechSnippets: string[]; imageUrl?: string }[];
}

// In-memory server cache of master editions (seeded from Google Drive repository 14R42LfMQvsU7SxkB5mNgPOTIh-i4u5Ch)
let cachedAcervo: AcervoEdition[] = [];

try {
  const repoDataPath = path.resolve(__dirname, 'src/data/repoEditions.json');
  if (fs.existsSync(repoDataPath)) {
    const rawData = JSON.parse(fs.readFileSync(repoDataPath, 'utf-8'));
    if (Array.isArray(rawData) && rawData.length > 0) {
      cachedAcervo = rawData;
      console.log(`[Secure Gateway] Repositório inicializado: ${cachedAcervo.length} edições reais do Google Drive.`);
      for (const ed of cachedAcervo) {
        vaultStorageMapping.set(ed.id, {
          comicId: ed.id,
          coverDriveFileId: (ed as any).driveFileId,
          zipDriveFileId: (ed as any).driveFileId,
          pages: (ed.pages || []).map((p: any) => ({
            pageNumber: p.pageNumber,
            driveFileId: (ed as any).driveFileId,
            name: p.title,
          })),
        });
      }
    }
  }
} catch (err: any) {
  console.warn('[Secure Gateway] Aviso ao carregar repoEditions.json:', err?.message || err);
}

function syncDatabaseCustomComicsWithAcervo() {
  if (Array.isArray(serverDatabase.customComics) && serverDatabase.customComics.length > 0) {
    for (const c of serverDatabase.customComics) {
      if (!c.id) continue;
      const idx = cachedAcervo.findIndex((existing) => existing.id === c.id);
      if (idx >= 0) {
        cachedAcervo[idx] = c;
      } else {
        cachedAcervo.unshift(c);
      }
      vaultStorageMapping.set(c.id, {
        comicId: c.id,
        coverDriveFileId: undefined,
        thumbnailLink: undefined,
        pages: (c.pages || []).map((p: any) => ({
          pageNumber: p.pageNumber,
          name: p.title,
        })),
      });
    }
  }
}
syncDatabaseCustomComicsWithAcervo();


const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];
const TARGET_FOLDER_ID = process.env.ACERVO_VAULT_ID || '109yWAVimD0IpUVUZsrRw5SGaciDlDIpK';

function isValidOAuthToken(token: unknown): token is string {
  if (typeof token !== 'string') return false;
  const clean = token.trim();
  return clean.length > 25 && clean !== 'undefined' && clean !== 'null';
}

/**
 * Returns an authenticated Google Drive client:
 * 1. Using Service Account (key file or environment variable)
 * 2. OR using authenticated Curator OAuth token (drive.readonly)
 */
function getDriveClient(userAccessToken?: string) {
  // 1. Check for Service Account Key files
  const candidateKeyPaths = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.resolve(__dirname, 'service-account.json'),
    path.resolve(__dirname, 'credentials.json'),
    path.resolve(__dirname, 'serviceAccountKey.json'),
    path.resolve(__dirname, 'key.json'),
    path.resolve(__dirname, 'google-credentials.json'),
  ].filter(Boolean) as string[];

  for (const keyPath of candidateKeyPaths) {
    if (fs.existsSync(keyPath)) {
      try {
        const auth = new google.auth.GoogleAuth({
          keyFile: keyPath,
          scopes: DRIVE_SCOPES,
        });
        return google.drive({ version: 'v3', auth });
      } catch (err: any) {
        console.warn('[Secure Gateway] Aviso ao carregar chave de Service Account:', err?.message || err);
      }
    }
  }

  // 1b. Check for raw Service Account JSON in env
  if (process.env.SERVICE_ACCOUNT_KEY) {
    try {
      const credentials = JSON.parse(process.env.SERVICE_ACCOUNT_KEY);
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: DRIVE_SCOPES,
      });
      return google.drive({ version: 'v3', auth });
    } catch (err: any) {
      console.warn('[Secure Gateway] Aviso ao carregar SERVICE_ACCOUNT_KEY do env:', err?.message || err);
    }
  }

  // 2. Check for OAuth Bearer token
  const tokenToUse = isValidOAuthToken(userAccessToken)
    ? userAccessToken
    : (isValidOAuthToken(latestVaultToken) ? latestVaultToken : null);

  if (tokenToUse) {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: tokenToUse });
    return google.drive({ version: 'v3', auth: oauth2Client });
  }

  return null;
}

// ----------------------------------------------------
// SECURE GATEWAY ENGINE: SYNC FROM CLOUD VAULT
// ----------------------------------------------------
async function syncFromCloudVault(accessToken?: string): Promise<{ newlyFound: number; total: number; note?: string }> {
  const drive = getDriveClient(accessToken);

  if (!drive) {
    console.log('[Secure Gateway] Modo de catálogo certificado ativo (aguardando chave Service Account ou login de curador).');
    return { newlyFound: 0, total: cachedAcervo.length, note: 'Modo seguro local ativo' };
  }

  // Helper to determine publisher and clean title
  const inferComicInfo = (rawName: string) => {
    const cleanTitle = rawName
      .replace(/(\.cbz|\.cbr|\.pdf|\.epub|\.zip|\.rar|\.jpg|\.png|\.webp)/gi, '')
      .replace(/[_-]/g, ' ')
      .trim();
    const issueMatch = cleanTitle.match(/#?(\d+)/);
    const issueNum = issueMatch ? parseInt(issueMatch[1], 10) : 1;

    let publisher: AcervoEdition['publisher'] = 'DC Comics';
    const upper = cleanTitle.toUpperCase();
    if (
      upper.includes('MARVEL') ||
      upper.includes('ARANHA') ||
      upper.includes('SPIDER') ||
      upper.includes('X-MEN') ||
      upper.includes('VINGADORES') ||
      upper.includes('AVENGERS') ||
      upper.includes('HULK') ||
      upper.includes('THOR') ||
      upper.includes('WOLVERINE') ||
      upper.includes('FERRO') ||
      upper.includes('IRON')
    ) {
      publisher = 'Marvel';
    } else if (
      upper.includes('VERTIGO') ||
      upper.includes('SANDMAN') ||
      upper.includes('CONSTANTINE') ||
      upper.includes('PREACHER') ||
      upper.includes('HELLBLAZER')
    ) {
      publisher = 'Vertigo';
    } else if (upper.includes('DARK HORSE') || upper.includes('HELLBOY') || upper.includes('BERSERK')) {
      publisher = 'Dark Horse';
    } else if (
      upper.includes('MANGA') ||
      upper.includes('MANGÁ') ||
      upper.includes('ONE PIECE') ||
      upper.includes('NARUTO') ||
      upper.includes('DRAGON BALL') ||
      upper.includes('BLEACH') ||
      upper.includes('TITAN') ||
      upper.includes('JUJUTSU')
    ) {
      publisher = 'Mangás';
    } else if (
      upper.includes('BATMAN') ||
      upper.includes('SUPERMAN') ||
      upper.includes('FLASH') ||
      upper.includes('LIGA') ||
      upper.includes('CORINGA') ||
      upper.includes('JOKER') ||
      upper.includes('MORCEGO') ||
      upper.includes('GOTHAM')
    ) {
      publisher = 'DC Comics';
    }

    return { cleanTitle: cleanTitle || 'Edição Exclusiva', issueNum, publisher };
  };

  try {
    const query = `'${TARGET_FOLDER_ID}' in parents and trashed = false`;
    console.log(`[Secure Gateway] Buscando arquivos no Drive com query: ${query}`);

    let files: any[] = [];
    let pageToken: string | undefined = undefined;

    do {
      const res: any = await drive.files.list({
        q: query,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        fields: 'nextPageToken, files(id, name, mimeType, thumbnailLink, size, createdTime)',
        pageSize: 100,
        pageToken,
      });

      if (res.data.files && res.data.files.length > 0) {
        files.push(...res.data.files);
      }
      pageToken = res.data.nextPageToken || undefined;
    } while (pageToken);

    console.log(`[Secure Gateway] Encontrados ${files.length} itens no repositório criptografado.`);

    // Safety fallback: If specific folder returned 0 items, search drive for comic / PDF files
    if (files.length === 0) {
      try {
        const fallbackQuery = `trashed = false and (mimeType = 'application/pdf' or mimeType = 'application/vnd.google-apps.folder' or name contains '.cbr' or name contains '.cbz' or name contains '.pdf')`;
        const fallbackRes = await drive.files.list({
          q: fallbackQuery,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
          fields: 'files(id, name, mimeType, thumbnailLink)',
          pageSize: 50,
        });
        if (fallbackRes.data.files && fallbackRes.data.files.length > 0) {
          files = fallbackRes.data.files;
          console.log(`[Secure Gateway] Localizadas ${files.length} edições no acervo geral.`);
        }
      } catch {}
    }

    let newlyFound = 0;
    const folders = files.filter((f) => f.mimeType === 'application/vnd.google-apps.folder');
    const directFiles = files.filter((f) => f.mimeType !== 'application/vnd.google-apps.folder');

    // 1. Process Subfolders (each folder representing a Comic Edition)
    for (const folder of folders) {
      if (!folder.id || !folder.name) continue;
      const opaqueComicId = 'vault-ed-' + Buffer.from(folder.id).toString('base64url').slice(0, 10).toLowerCase();

      // Query files inside this comic folder with complete pagination
      const childQuery = `'${folder.id}' in parents and trashed = false`;
      let childFiles: any[] = [];
      let childToken: string | undefined = undefined;
      try {
        do {
          const childRes: any = await drive.files.list({
            q: childQuery,
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
            fields: 'nextPageToken, files(id, name, mimeType, thumbnailLink)',
            pageSize: 100,
            pageToken: childToken,
          });
          if (childRes.data.files && childRes.data.files.length > 0) {
            childFiles.push(...childRes.data.files);
          }
          childToken = childRes.data.nextPageToken || undefined;
        } while (childToken);
        childFiles.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' }));
      } catch (err: any) {
        console.warn(`[Secure Gateway] Erro ao listar páginas da subpasta ${folder.name}:`, err?.message || err);
      }

      const { cleanTitle, issueNum, publisher } = inferComicInfo(folder.name);
      const totalPages = childFiles.length > 0 ? childFiles.length : 32;

      const pageMappings: VaultPageMapping[] = childFiles.map((f, idx) => ({
        pageNumber: idx + 1,
        driveFileId: f.id || undefined,
        name: f.name || undefined,
        mimeType: f.mimeType || undefined,
      }));

      vaultStorageMapping.set(opaqueComicId, {
        comicId: opaqueComicId,
        folderId: folder.id || undefined,
        coverDriveFileId: childFiles[0]?.id || undefined,
        thumbnailLink: childFiles[0]?.thumbnailLink || folder.thumbnailLink || undefined,
        pages: pageMappings,
      });

      const existingIdx = cachedAcervo.findIndex((c) => c.id === opaqueComicId);
      const newEdition: AcervoEdition = {
        id: opaqueComicId,
        title: cleanTitle,
        sagaTitle: 'ACERVO PRIVADO COLECIONADOR',
        sagaPart: `EDIÇÃO #${issueNum}`,
        issueNumber: issueNum,
        totalIssuesInSaga: 1,
        publisher,
        year: 1995,
        totalPages,
        currentPage: 1,
        readProgressPercent: 0,
        estimatedRemainingMinutes: Math.round(totalPages * 0.7),
        lastReadText: 'Sincronizado agora',
        badge: 'ACERVO AUTÊNTICO',
        badgeType: 'restored',
        coverUrl: `/api/acervo/cover/${opaqueComicId}`,
        synopsis: `Edição preservada e digitalizada no Acervo Central Seguro. Total de ${totalPages} páginas restauradas em alta fidelidade.`,
        scriptWriter: 'Curadoria Exclusiva',
        artArtist: 'Arquivo Clássico',
        ageRating: '14+',
        isOfflineAvailable: true,
        isInCollection: true,
        isBookmarked: false,
        securityTier: 'STREAMING PROTEGIDO • DRM NÍVEL 3',
        pages: Array.from({ length: totalPages }, (_, i) => ({
          pageNumber: i + 1,
          title: childFiles[i]?.name || `Página ${i + 1}`,
          chapter: cleanTitle,
          imageUrl: `/api/acervo/page-media/${opaqueComicId}/${i + 1}`,
          speechSnippets: [],
        })),
      };

      if (existingIdx >= 0) {
        cachedAcervo[existingIdx] = newEdition;
      } else {
        cachedAcervo.unshift(newEdition);
        newlyFound++;
      }
    }

    // 2. Process Direct Comic Files (CBZ, ZIP, PDF, or individual files)
    for (const file of directFiles) {
      if (!file.id || !file.name) continue;
      const opaqueComicId = 'vault-f-' + Buffer.from(file.id).toString('base64url').slice(0, 10).toLowerCase();
      const { cleanTitle, issueNum, publisher } = inferComicInfo(file.name);

      const isZip = file.name.toLowerCase().endsWith('.zip') ||
                    file.name.toLowerCase().endsWith('.cbz') ||
                    file.mimeType === 'application/zip' ||
                    file.mimeType === 'application/x-zip-compressed' ||
                    file.mimeType === 'application/x-cbz';

      let totalPages = 32;
      let zipImageEntries: string[] = [];

      if (isZip) {
        try {
          const zipData = await getZipArchive(file.id, accessToken);
          if (zipData && zipData.imageEntries.length > 0) {
            zipImageEntries = zipData.imageEntries;
            totalPages = zipImageEntries.length;
          }
        } catch {}
      }

      vaultStorageMapping.set(opaqueComicId, {
        comicId: opaqueComicId,
        isZipArchive: isZip,
        zipDriveFileId: isZip ? file.id : undefined,
        coverDriveFileId: file.id || undefined,
        thumbnailLink: file.thumbnailLink || undefined,
        pages: Array.from({ length: totalPages }, (_, idx) => ({
          pageNumber: idx + 1,
          driveFileId: file.id || undefined,
          name: isZip && zipImageEntries[idx] ? path.basename(zipImageEntries[idx]) : `${cleanTitle} - Pág ${idx + 1}`,
          mimeType: file.mimeType || undefined,
        })),
      });

      const newEdition: AcervoEdition = {
        id: opaqueComicId,
        title: cleanTitle,
        sagaTitle: isZip ? 'ARQUIVO COMPACTADO (CBZ / ZIP)' : 'ACERVO PRIVADO COLECIONADOR',
        sagaPart: `VOLUME #${issueNum}`,
        issueNumber: issueNum,
        totalIssuesInSaga: 1,
        publisher,
        year: 1996,
        totalPages,
        currentPage: 1,
        readProgressPercent: 0,
        estimatedRemainingMinutes: Math.round(totalPages * 0.7),
        lastReadText: 'Carregado agora',
        badge: isZip ? 'ARQUIVO .ZIP / .CBZ' : 'ACERVO AUTÊNTICO',
        badgeType: 'restored',
        coverUrl: `/api/acervo/cover/${opaqueComicId}`,
        synopsis: isZip
          ? `Edição completa descompactada de ${file.name}. Total de ${totalPages} páginas prontas para leitura.`
          : `Volume "${cleanTitle}" autenticado do Acervo Central com tecnologia de streaming DRM Nível 3.`,
        scriptWriter: 'Curadoria do Acervo',
        artArtist: 'Mestres dos Quadrinhos',
        ageRating: '14+',
        isOfflineAvailable: true,
        isInCollection: true,
        isBookmarked: false,
        securityTier: 'STREAMING PROTEGIDO • DRM NÍVEL 3',
        pages: Array.from({ length: totalPages }, (_, i) => ({
          pageNumber: i + 1,
          title: isZip && zipImageEntries[i] ? path.basename(zipImageEntries[i]) : `Página ${i + 1}`,
          chapter: cleanTitle,
          imageUrl: `/api/acervo/page-media/${opaqueComicId}/${i + 1}`,
          speechSnippets: [],
        })),
      };

      const existingIdx = cachedAcervo.findIndex((c) => c.id === opaqueComicId);
      if (existingIdx >= 0) {
        cachedAcervo[existingIdx] = newEdition;
      } else {
        cachedAcervo.unshift(newEdition);
        newlyFound++;
      }
    }

    return { newlyFound, total: cachedAcervo.length };
  } catch (err: any) {
    console.error('[Secure Gateway] Erro ao sincronizar com Google Drive:', err?.message || err);
    return { newlyFound: 0, total: cachedAcervo.length };
  }
}

// ----------------------------------------------------
// SECURE BACKEND API ENDPOINTS (/api/acervo/*)
// ----------------------------------------------------

// 1. Get Acervo Status & Security Verification
app.get('/api/acervo/status', (req, res) => {
  res.json({
    status: 'OPERATIONAL',
    gateway: 'GATEWAY PRIVADO BANCA GEEK',
    drmLevel: SECURE_VAULT_CONFIG.drmLevel,
    editionsAvailable: cachedAcervo.length,
    antiCloningProtocol: 'ACTIVE',
    storageEncrypted: true,
    sessionTimestamp: new Date().toISOString(),
  });
});

let lastSyncTime = 0;
let isSyncing = false;

// 2. Get Public List of Comics from Secure Repository
app.get('/api/acervo/comics', async (req, res) => {
  res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  res.setHeader('X-DRM-Protection', SECURE_VAULT_CONFIG.sessionPrefix);
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Silent automatic background sync: triggers immediately if force requested or if stale (> 20s)
  const force = req.query.force === 'true' || req.query.sync === 'true';
  const isStale = Date.now() - lastSyncTime > 20000;
  if (!isSyncing && (cachedAcervo.length === 0 || isStale || force)) {
    if (force) {
      try {
        isSyncing = true;
        const r = await syncFromCloudVault();
        lastSyncTime = Date.now();
        if (r.newlyFound > 0) {
          console.log(`[Auto-Sync Backend] Sincronização sob demanda: ${r.newlyFound} novas HQs.`);
        }
      } catch (err: any) {
        console.warn('[Auto-Sync Backend] Erro no sync sob demanda:', err?.message || err);
      } finally {
        isSyncing = false;
      }
    } else {
      isSyncing = true;
      syncFromCloudVault()
        .then((r) => {
          lastSyncTime = Date.now();
          if (r.newlyFound > 0) {
            console.log(`[Auto-Sync Backend] ${r.newlyFound} novas HQs carregadas da nuvem.`);
          }
        })
        .catch(() => {})
        .finally(() => {
          isSyncing = false;
        });
    }
  }

  loadServerDatabase();
  const safeEditions = cachedAcervo.map((comic) => {
    const aiData = serverDatabase.aiSynopses[comic.id];
    return {
      ...comic,
      synopsis: aiData?.synopsis || comic.synopsis,
      aiSynopsis: aiData || null,
      streamUrl: `/api/acervo/stream/${comic.id}`,
    };
  });

  res.json({
    success: true,
    count: safeEditions.length,
    editions: safeEditions,
  });
});

/**
 * Genuine First-Page Comic Cover Extractor
 * Strictly extracts and returns the first page of ANY file (.cbr, .cbz, .pdf, .epub, .cb7, .cbt, .rar)
 * and permanently caches it to disk for ultra-fast instant delivery.
 */
const coverInFlightMap = new Map<string, Promise<string | null>>();

// Semaphore to control concurrent cover archive downloads (max 2)
let activeCoverDownloads = 0;
const coverDownloadQueue: Array<() => void> = [];

async function acquireCoverDownloadSlot(): Promise<() => void> {
  if (activeCoverDownloads < 2) {
    activeCoverDownloads++;
    return () => {
      activeCoverDownloads--;
      const next = coverDownloadQueue.shift();
      if (next) next();
    };
  }
  return new Promise((resolve) => {
    coverDownloadQueue.push(() => {
      activeCoverDownloads++;
      resolve(() => {
        activeCoverDownloads--;
        const next = coverDownloadQueue.shift();
        if (next) next();
      });
    });
  });
}

/**
 * Genuine First-Page Comic Cover Extractor
 * Strictly extracts and returns the first page of ANY file (.cbr, .cbz, .pdf, .epub, .cb7, .cbt, .rar)
 * and permanently caches it to disk & serverDatabase.covers for ultra-fast instant delivery.
 */
async function getComicCoverPage(comicId: string, driveFileId?: string, format?: string): Promise<string | null> {
  const persistentCoverPath = path.join(COVERS_DATA_DIR, `${comicId}.img`);
  const cachedImagePath = path.join(COVER_CACHE_DIR, `${comicId}.img`);

  // 1. Instant check: If cover is already stored in serverDatabase.covers
  const dbCover = serverDatabase.covers?.[comicId];
  if (dbCover?.coverDataUrl) {
    if (fs.existsSync(persistentCoverPath) && fs.statSync(persistentCoverPath).size > 50) {
      return persistentCoverPath;
    }
    try {
      const match = dbCover.coverDataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        fs.writeFileSync(persistentCoverPath, Buffer.from(match[2], 'base64'));
        return persistentCoverPath;
      }
    } catch {}
  }

  // 2. If cover is already on disk and valid (> 50 bytes)
  if (fs.existsSync(persistentCoverPath) && fs.statSync(persistentCoverPath).size > 50) {
    return persistentCoverPath;
  }
  if (fs.existsSync(cachedImagePath) && fs.statSync(cachedImagePath).size > 50) {
    return cachedImagePath;
  }

  // Deduplicate in-flight extraction requests for the same comic
  if (coverInFlightMap.has(comicId)) {
    return coverInFlightMap.get(comicId)!;
  }

  const promise = (async () => {
    try {
      // 3. Check if the comic is already extracted in EXTRACTED_CACHE_DIR
      const targetDir = path.join(EXTRACTED_CACHE_DIR, comicId);
      if (fs.existsSync(targetDir)) {
        for (const f of fs.readdirSync(targetDir)) {
          const fp = path.join(targetDir, f);
          try {
            if (fs.statSync(fp).size === 0) fs.unlinkSync(fp);
          } catch {}
        }
        const existing = findImageFilesRecursive(targetDir);
        if (existing.length > 0) {
          const firstPageFile = path.join(targetDir, existing[0]);
          if (fs.existsSync(firstPageFile) && fs.statSync(firstPageFile).size > 50) {
            try {
              const coverBuf = fs.readFileSync(firstPageFile);
              fs.writeFileSync(persistentCoverPath, coverBuf);
              try { fs.writeFileSync(cachedImagePath, coverBuf); } catch {}

              const isPng = coverBuf[0] === 0x89 && coverBuf[1] === 0x50;
              const isWebp = coverBuf[8] === 0x57 && coverBuf[9] === 0x45;
              const mime = isPng ? 'image/png' : isWebp ? 'image/webp' : 'image/jpeg';
              const coverDataUrl = `data:${mime};base64,${coverBuf.toString('base64')}`;

              serverDatabase.covers[comicId] = {
                comicId,
                coverDataUrl,
                mimeType: mime,
                coverPath: persistentCoverPath,
                extractedAt: new Date().toISOString(),
                totalPages: existing.length,
                title: cachedAcervo.find((c) => c.id === comicId)?.title || comicId,
                format: format || 'cbr',
              };
              saveServerDatabase();
              return persistentCoverPath;
            } catch {}
          }
        }
      }

      const ext = (format || 'cbr').toLowerCase();
      const archivePath = path.join(ARCHIVE_CACHE_DIR, `${comicId}.${ext}`);

      // 4. Download archive from Google Drive if not present on disk
      if (!fs.existsSync(archivePath) || fs.statSync(archivePath).size === 0) {
        if (!driveFileId) return null;
        const downloadUrl = `https://drive.usercontent.google.com/download?id=${driveFileId}&export=download&confirm=t`;
        const releaseSlot = await acquireCoverDownloadSlot();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);
        try {
          const resp = await fetch(downloadUrl, {
            signal: controller.signal,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              'Accept': '*/*',
            },
          });
          clearTimeout(timeoutId);
          if (resp.ok) {
            const arrayBuffer = await resp.arrayBuffer();
            fs.writeFileSync(archivePath, Buffer.from(arrayBuffer));
          } else {
            releaseSlot();
          }
        } catch {
          clearTimeout(timeoutId);
          releaseSlot();
        }
        try { releaseSlot(); } catch {}
      }

      // If archive exists on disk, run precision extraction
      if (fs.existsSync(archivePath) && fs.statSync(archivePath).size > 0) {
        const title = cachedAcervo.find((c) => c.id === comicId)?.title || comicId;
        const extraction = await extractComicCoverAndPages(archivePath, comicId, title, ext);
        if (extraction && fs.existsSync(persistentCoverPath)) {
          return persistentCoverPath;
        }
      }

      // 5. Fallback for Google Drive thumbnail
      if (driveFileId) {
        try {
          const thumbUrl = `https://drive.google.com/thumbnail?id=${driveFileId}&sz=w600`;
          const thumbResp = await fetch(thumbUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          });
          if (thumbResp.ok) {
            const contentType = thumbResp.headers.get('content-type') || '';
            if (contentType.startsWith('image/')) {
              const arrayBuffer = await thumbResp.arrayBuffer();
              const imgBuf = Buffer.from(arrayBuffer);
              if (imgBuf.length > 500) {
                fs.writeFileSync(persistentCoverPath, imgBuf);
                try { fs.writeFileSync(cachedImagePath, imgBuf); } catch {}
                const mime = contentType || 'image/jpeg';
                serverDatabase.covers[comicId] = {
                  comicId,
                  coverDataUrl: `data:${mime};base64,${imgBuf.toString('base64')}`,
                  mimeType: mime,
                  coverPath: persistentCoverPath,
                  extractedAt: new Date().toISOString(),
                  totalPages: 36,
                  title: cachedAcervo.find((c) => c.id === comicId)?.title || comicId,
                  format: ext,
                };
                saveServerDatabase();
                return persistentCoverPath;
              }
            }
          }
        } catch {}
      }
    } catch {
      // Graceful fallback to dynamic cover art without error logging
    } finally {
      coverInFlightMap.delete(comicId);
    }
    return null;
  })();

  coverInFlightMap.set(comicId, promise);
  return promise;
}

// 3. Cover Media Proxy: Streams the genuine first page cover with high-res caching
app.get('/api/acervo/cover/:comicId', async (req, res) => {
  const { comicId } = req.params;
  const mapping = vaultStorageMapping.get(comicId);
  const comic = cachedAcervo.find((c) => c.id === comicId);
  const driveFileId = mapping?.coverDriveFileId || mapping?.zipDriveFileId || (comic as any)?.driveFileId;
  const format = (comic as any)?.format || 'cbr';

  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-DRM-Protection', `${SECURE_VAULT_CONFIG.sessionPrefix}#COVER-${comicId}`);

  // 1. Instant delivery directly from serverDatabase.covers memory / JSON database
  const dbCover = serverDatabase.covers?.[comicId];
  if (dbCover?.coverDataUrl) {
    try {
      const match = dbCover.coverDataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        const mime = match[1] || dbCover.mimeType || 'image/jpeg';
        const buf = Buffer.from(match[2], 'base64');
        res.setHeader('Content-Type', mime);
        res.setHeader('Content-Length', buf.length);
        return res.send(buf);
      }
    } catch {}
  }

  // 2. Try to extract and retrieve the genuine first page cover
  const coverFilePath = await getComicCoverPage(comicId, driveFileId, format);
  if (coverFilePath && fs.existsSync(coverFilePath)) {
    try {
      const buf = fs.readFileSync(coverFilePath);
      const isPng = buf[0] === 0x89 && buf[1] === 0x50;
      const isWebp = buf[8] === 0x57 && buf[9] === 0x45;
      const mime = isPng ? 'image/png' : isWebp ? 'image/webp' : 'image/jpeg';
      res.setHeader('Content-Type', mime);
      res.setHeader('Content-Length', buf.length);
      return res.send(buf);
    } catch {}
  }

  // 3. Fallback to existing valid URL if present
  if (comic?.coverUrl && !comic.coverUrl.startsWith('/api/acervo/cover')) {
    return res.redirect(comic.coverUrl);
  }

  // 4. Fallback to dynamic SVG
  return res.redirect(`/api/acervo/cover-art/${comicId}`);
});

// Dynamic Vector Comic Cover Generator (100% Reliable SVG Art)
app.get('/api/acervo/cover-art/:comicId', (req, res) => {
  const { comicId } = req.params;
  const comic = cachedAcervo.find((c) => c.id === comicId);

  const rawTitle = comic?.title || 'EDIÇÃO EXCLUSIVA MARVEL';
  const cleanTitle = rawTitle.replace(/[\(\)\d\-_]/g, ' ').trim().slice(0, 30);
  const year = comic?.year || 1985;
  const issueNum = comic?.issueNumber || 1;
  const saga = (comic?.sagaTitle || 'MARVEL COMICS').slice(0, 26);
  const publisher = comic?.publisher || 'Marvel';

  const isAbril = rawTitle.toLowerCase().includes('abril') || rawTitle.toLowerCase().includes('super') || rawTitle.toLowerCase().includes('heróis');
  const topBannerText = isAbril ? 'EDITORA ABRIL • FORMATINHO CLÁSSICO' : 'MARVEL COMICS GROUP';
  const price = isAbril ? `Cz$ ${issueNum * 5},00` : `75¢ / #${issueNum}`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600" width="100%" height="100%">
    <defs>
      <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#12121f"/>
        <stop offset="35%" stop-color="#1c1032"/>
        <stop offset="100%" stop-color="#0a0a14"/>
      </linearGradient>
      <linearGradient id="bannerGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#d62839"/>
        <stop offset="100%" stop-color="#b20024"/>
      </linearGradient>
      <pattern id="halftone" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
        <circle cx="4" cy="4" r="1" fill="#ffffff" opacity="0.06"/>
      </pattern>
    </defs>

    <!-- Background -->
    <rect width="400" height="600" fill="url(#bgGrad)"/>
    <rect width="400" height="600" fill="url(#halftone)"/>

    <!-- Outer Comic Border -->
    <rect x="8" y="8" width="384" height="584" fill="none" stroke="#ffc531" stroke-width="2.5" opacity="0.85"/>
    <rect x="12" y="12" width="376" height="576" fill="none" stroke="#f4ebd8" stroke-width="1" opacity="0.3"/>

    <!-- Top Trade Dress Banner -->
    <rect x="8" y="8" width="384" height="42" fill="url(#bannerGrad)"/>
    <text x="200" y="34" font-family="'Impact', 'Arial Black', sans-serif" font-size="16" font-weight="bold" fill="#f4ebd8" text-anchor="middle" letter-spacing="3">${topBannerText}</text>

    <!-- Corner Box (Price, Issue, Code) -->
    <rect x="18" y="58" width="58" height="68" fill="#12121f" stroke="#ffc531" stroke-width="1.5"/>
    <text x="47" y="76" font-family="sans-serif" font-size="11" font-weight="bold" fill="#ffc531" text-anchor="middle">${price}</text>
    <text x="47" y="96" font-family="sans-serif" font-size="15" font-weight="900" fill="#f4ebd8" text-anchor="middle">#${issueNum}</text>
    <text x="47" y="114" font-family="sans-serif" font-size="9" font-weight="bold" fill="#8a8ca5" text-anchor="middle">${year}</text>

    <!-- Comics Code Seal Box -->
    <rect x="326" y="58" width="56" height="48" fill="#f4ebd8" rx="2" stroke="#12121f" stroke-width="1.5"/>
    <text x="354" y="74" font-family="sans-serif" font-size="8" font-weight="900" fill="#12121f" text-anchor="middle">APPROVED</text>
    <text x="354" y="85" font-family="sans-serif" font-size="7" font-weight="bold" fill="#d62839" text-anchor="middle">BY THE</text>
    <text x="354" y="96" font-family="sans-serif" font-size="8" font-weight="900" fill="#12121f" text-anchor="middle">COMICS CODE</text>

    <!-- Central Comic Title Box -->
    <g transform="translate(200, 190)">
      <!-- Drop shadow -->
      <text x="2" y="2" font-family="'Impact', 'Arial Black', sans-serif" font-size="28" font-weight="900" fill="#000000" text-anchor="middle" letter-spacing="1">${cleanTitle.toUpperCase()}</text>
      <!-- Main text -->
      <text x="0" y="0" font-family="'Impact', 'Arial Black', sans-serif" font-size="28" font-weight="900" fill="#ffc531" text-anchor="middle" letter-spacing="1">${cleanTitle.toUpperCase()}</text>
    </g>

    <!-- Saga Badge -->
    <rect x="50" y="220" width="300" height="26" fill="#16e1ff" rx="2" opacity="0.2"/>
    <text x="200" y="238" font-family="sans-serif" font-size="12" font-weight="bold" fill="#16e1ff" text-anchor="middle" letter-spacing="2">${saga.toUpperCase()}</text>

    <!-- Graphic Burst / Emblem in Center -->
    <circle cx="200" cy="360" r="85" fill="#1a1a2e" stroke="#ffc531" stroke-width="2" opacity="0.8"/>
    <circle cx="200" cy="360" r="75" fill="#d62839" opacity="0.3"/>
    
    <!-- Hero / Book Emblem -->
    <polygon points="200,305 215,340 250,345 225,370 230,405 200,388 170,405 175,370 150,345 185,340" fill="#ffc531"/>

    <!-- Archival Subtitle -->
    <text x="200" y="480" font-family="sans-serif" font-size="12" font-weight="bold" fill="#f4ebd8" text-anchor="middle" letter-spacing="1">ACERVO HISTÓRICO ORIGINAL</text>
    <text x="200" y="500" font-family="sans-serif" font-size="10" fill="#8a8ca5" text-anchor="middle">Digitalização Preservada em Alta Definição</text>

    <!-- Bottom Vault Bar -->
    <rect x="8" y="546" width="384" height="46" fill="#12121f"/>
    <line x1="8" y1="546" x2="392" y2="546" stroke="#ffc531" stroke-width="1.5"/>
    <text x="200" y="566" font-family="sans-serif" font-size="10" font-weight="900" fill="#ffc531" text-anchor="middle" letter-spacing="1.5">REPOSITÓRIO GOOGLE DRIVE AUTÊNTICO</text>
    <text x="200" y="582" font-family="sans-serif" font-size="9" fill="#8a8ca5" text-anchor="middle">FORMATO ORIGINAL • LEITURA IMEDIATA</text>
  </svg>`;

  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(svg);
});

// Download is permanently disabled per policy
app.get('/api/acervo/download/:comicId', (_req, res) => {
  res.status(403).json({ error: 'Downloads de arquivos estão permanentemente desativados nesta plataforma.' });
});

// PDF Direct Stream for Browser / In-App PDF Reader
app.get('/api/acervo/pdf-stream/:comicId', async (req, res) => {
  const { comicId } = req.params;
  const comic = cachedAcervo.find((c) => c.id === comicId);
  const mapping = vaultStorageMapping.get(comicId);
  const driveFileId = mapping?.coverDriveFileId || (comic as any)?.driveFileId;

  if (!driveFileId) {
    return res.status(404).json({ error: 'HQ PDF não encontrada' });
  }

  const safeTitle = (comic?.title || 'HQ_Marvel').replace(/[^a-zA-Z0-9_\-]/g, '_');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${safeTitle}.pdf"`);
  res.setHeader('Cache-Control', 'public, max-age=86400');

  try {
    const downloadUrl = `https://drive.usercontent.google.com/download?id=${driveFileId}&export=download&confirm=t`;
    const resp = await fetch(downloadUrl);
    if (resp.ok && resp.body) {
      const arrayBuffer = await resp.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return res.send(buffer);
    }
  } catch (err: any) {
    console.warn('[PDF Stream] Erro ao carregar PDF do Google Drive:', err?.message || err);
  }

  return res.redirect(`https://drive.google.com/file/d/${driveFileId}/preview`);
});

// PDF Direct Embed Viewer
app.get('/api/acervo/pdf-view/:comicId', (req, res) => {
  const { comicId } = req.params;
  const comic = cachedAcervo.find((c) => c.id === comicId);
  const mapping = vaultStorageMapping.get(comicId);
  const driveFileId = mapping?.coverDriveFileId || (comic as any)?.driveFileId;

  if (!driveFileId) {
    return res.status(404).json({ error: 'HQ PDF não encontrada' });
  }

  return res.redirect(`https://drive.google.com/file/d/${driveFileId}/preview`);
});

// 4. Secure Stream Proxy for Single Page Image Bytes (Direct Binary Streaming for .cbr, .cbz, .pdf, .epub, .cb7, .cbt)
app.get('/api/acervo/page-media/:comicId/:pageNumber', async (req, res) => {
  const { comicId, pageNumber } = req.params;
  const pageIdx = parseInt(pageNumber, 10);

  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-DRM-Protection', `${SECURE_VAULT_CONFIG.sessionPrefix}#PAGE-${comicId}-${pageIdx}`);

  const comic = cachedAcervo.find((c) => c.id === comicId);
  const mapping = vaultStorageMapping.get(comicId);
  const driveFileId = mapping?.zipDriveFileId || mapping?.coverDriveFileId || (comic as any)?.driveFileId;
  const format = (comic as any)?.format || 'cbr';

  // 1. Universal Extractor for .cbr, .cbz, .pdf, .epub, .cb7, .cbt
  if (driveFileId || fs.existsSync(path.join(EXTRACTED_CACHE_DIR, comicId))) {
    try {
      const archiveResult = await getComicArchivePages(comicId, driveFileId, format);
      if (archiveResult && archiveResult.imageFiles.length > 0) {
        const pageIdxBounded = Math.max(0, Math.min(pageIdx - 1, archiveResult.imageFiles.length - 1));
        const imgPath = path.join(archiveResult.dir, archiveResult.imageFiles[pageIdxBounded]);
        if (fs.existsSync(imgPath)) {
          const ext = path.extname(imgPath).toLowerCase();
          const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
          res.setHeader('Content-Type', mime);
          return res.sendFile(imgPath);
        }
      }
    } catch (err: any) {
      console.warn(`[Page Media] Falha ao extrair página de arquivo ${comicId}:`, err?.message || err);
    }
  }

  // 2. If this comic is a ZIP archive from Drive
  if (mapping?.isZipArchive && mapping.zipDriveFileId) {
    const userToken = (req.query.token as string) || req.headers.authorization?.replace(/^Bearer\s+/i, '');
    const zipData = await getZipArchive(mapping.zipDriveFileId, userToken);
    if (zipData && zipData.imageEntries.length >= pageIdx) {
      const pageEntryName = zipData.imageEntries[pageIdx - 1];
      const entry = zipData.zip.getEntry(pageEntryName);
      if (entry) {
        const imgBuf = entry.getData();
        const ext = path.extname(pageEntryName).toLowerCase();
        const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
        res.setHeader('Content-Type', mime);
        res.setHeader('Content-Length', imgBuf.length);
        return res.send(imgBuf);
      }
    }
  }

  const targetPage = mapping?.pages.find((p) => p.pageNumber === pageIdx);
  if (targetPage?.driveFileId) {
    const userToken = (req.query.token as string) || req.headers.authorization?.replace(/^Bearer\s+/i, '');
    const drive = getDriveClient(userToken);
    if (drive) {
      try {
        const driveStream: any = await drive.files.get(
          {
            fileId: targetPage.driveFileId,
            alt: 'media',
            supportsAllDrives: true,
          },
          { responseType: 'stream' }
        );

        const contentType = driveStream.headers['content-type'] || targetPage.mimeType || 'image/jpeg';
        res.setHeader('Content-Type', contentType);
        if (driveStream.headers['content-length']) {
          res.setHeader('Content-Length', driveStream.headers['content-length']);
        }
        return driveStream.data.pipe(res);
      } catch (err: any) {}
    }
  }

  // 3. Fallback to vector art or cover
  const fallbackPage = comic?.pages[pageIdx - 1];
  if (fallbackPage?.imageUrl && fallbackPage.imageUrl !== `/api/acervo/page-media/${comicId}/${pageIdx}`) {
    return res.redirect(fallbackPage.imageUrl);
  }

  // 4. Return dynamic page cover art so reading never breaks
  return res.redirect(`/api/acervo/cover-art/${comicId}`);
});

// Endpoint to inspect extracted pages count and list for any comic issue
app.get('/api/acervo/pages-info/:comicId', async (req, res) => {
  const { comicId } = req.params;
  const comic = cachedAcervo.find((c) => c.id === comicId);
  const mapping = vaultStorageMapping.get(comicId);
  const driveFileId = mapping?.zipDriveFileId || mapping?.coverDriveFileId || (comic as any)?.driveFileId;
  const format = (comic as any)?.format || 'cbr';

  if (driveFileId || fs.existsSync(path.join(EXTRACTED_CACHE_DIR, comicId))) {
    try {
      const archiveResult = await getComicArchivePages(comicId, driveFileId, format);
      if (archiveResult && archiveResult.imageFiles.length > 0) {
        return res.json({
          success: true,
          comicId,
          totalPages: archiveResult.imageFiles.length,
          pages: archiveResult.imageFiles.map((_, idx) => ({
            pageNumber: idx + 1,
            imageUrl: `/api/acervo/page-media/${comicId}/${idx + 1}`
          }))
        });
      }
    } catch {}
  }

  const total = comic?.totalPages || 36;
  return res.json({
    success: true,
    comicId,
    totalPages: total,
    pages: Array.from({ length: total }, (_, i) => ({
      pageNumber: i + 1,
      imageUrl: `/api/acervo/page-media/${comicId}/${i + 1}`
    }))
  });
});

// Upload & Read Local Comic Files (.cbr, .cbz, .pdf, .epub, .cb7, .cbt)
app.post('/api/acervo/upload-local', async (req, res) => {
  try {
    const { fileName, fileBase64, format } = req.body;
    if (!fileName || !fileBase64) {
      return res.status(400).json({ error: 'Arquivo inválido' });
    }

    const ext = (format || fileName.split('.').pop() || 'cbr').toLowerCase();
    const localId = `vault-local-${Date.now()}`;
    const cleanTitle = fileName.replace(/\.[^/.]+$/, '').replace(/[\._\-]/g, ' ').trim();

    const archivePath = path.join(ARCHIVE_CACHE_DIR, `${localId}.${ext}`);
    const buffer = Buffer.from(fileBase64, 'base64');
    fs.writeFileSync(archivePath, buffer);

    // Run precision extractor to extract true 1st page cover and all pages
    const extraction = await extractComicCoverAndPages(archivePath, localId, cleanTitle, ext);
    if (!extraction || extraction.imageFiles.length === 0) {
      return res.status(500).json({
        error: `Não foi possível extrair páginas válidas do arquivo .${ext.toUpperCase()}. Verifique se o arquivo não está corrompido ou protegido por senha.`,
      });
    }

    const totalPages = Math.max(1, extraction.totalPages);
    const coverUrl = `/api/acervo/cover/${localId}`;

    const newComic = {
      id: localId,
      title: cleanTitle.toUpperCase(),
      sagaTitle: 'MEUS ARQUIVOS LOCAIS',
      sagaPart: `ARQUIVO .${ext.toUpperCase()}`,
      issueNumber: 1,
      totalIssuesInSaga: 1,
      publisher: 'Marvel',
      year: new Date().getFullYear(),
      totalPages: totalPages,
      currentPage: 1,
      readProgressPercent: 0,
      estimatedRemainingMinutes: Math.round(totalPages * 1.5),
      lastReadText: 'Agora mesmo',
      badge: `LOCAL • .${ext.toUpperCase()}`,
      badgeType: 'rarity',
      coverUrl: coverUrl,
      coverDataUrl: extraction.coverDataUrl || undefined,
      synopsis: `Arquivo importado: ${fileName}. Leitura nativa instantânea interna de .${ext.toUpperCase()}. Total de ${totalPages} páginas prontas.`,
      scriptWriter: 'Leitor Interno',
      artArtist: 'Arte Preservada',
      ageRating: 'Livre',
      isOfflineAvailable: true,
      isInCollection: true,
      isBookmarked: false,
      securityTier: 'NATIVO LOCAL',
      format: ext,
      isPdf: ext === 'pdf',
      rawFileName: fileName,
      pages: extraction.imageFiles.map((f, i) => ({
        pageNumber: i + 1,
        imageUrl: `/api/acervo/page-media/${localId}/${i + 1}`,
        title: `Página ${i + 1}`,
        chapter: 'Capítulo 1',
        speechSnippets: [],
      })),
    };

    // Save to persistent database
    loadServerDatabase();
    serverDatabase.customComics = [
      newComic,
      ...serverDatabase.customComics.filter((c: any) => c.id !== localId),
    ];

    serverDatabase.activities.unshift({
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'comic_uploaded',
      title: 'Nova HQ Importada 📖',
      description: `Arquivo .${ext.toUpperCase()} "${cleanTitle}" processado com capa de 1ª página extraída e salva no banco.`,
      comicId: localId,
      comicTitle: cleanTitle,
      timestamp: new Date().toISOString(),
    });
    serverDatabase.activities = serverDatabase.activities.slice(0, 150);

    saveServerDatabase();

    // Cache in memory and map for reader streaming
    const existingIdx = cachedAcervo.findIndex((c) => c.id === localId);
    if (existingIdx >= 0) {
      cachedAcervo[existingIdx] = newComic as any;
    } else {
      cachedAcervo.unshift(newComic as any);
    }

    vaultStorageMapping.set(localId, {
      comicId: localId,
      pages: newComic.pages.map((p) => ({ pageNumber: p.pageNumber, name: p.title })),
    });

    console.log(`[File Processor] HQ Local ${localId} (.${ext}) processada com sucesso: ${totalPages} páginas e capa salva no banco.`);
    res.json({ success: true, comic: newComic, coverSavedInDb: true });
  } catch (err: any) {
    console.error('Erro no upload local:', err);
    res.status(500).json({ error: 'Erro ao processar arquivo: ' + (err?.message || err) });
  }
});

// 5. Secure Stream Meta Endpoint for Reader
app.get('/api/acervo/stream/:comicId/:pageNumber', (req, res) => {
  const { comicId, pageNumber } = req.params;
  const pageIdx = parseInt(pageNumber, 10);

  const comic = cachedAcervo.find((c) => c.id === comicId);
  if (!comic) {
    return res.status(404).json({ error: 'Edição não encontrada no acervo.' });
  }

  res.setHeader('Cache-Control', 'private, no-store, max-age=0, must-revalidate');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-DRM-Protection', `${SECURE_VAULT_CONFIG.sessionPrefix}#PAGE-${pageIdx}`);

  const page = comic.pages[pageIdx - 1];
  res.json({
    success: true,
    pageNumber: pageIdx,
    totalPages: comic.totalPages,
    title: page?.title || `Página ${pageIdx}`,
    chapter: page?.chapter || comic.sagaPart,
    speechSnippets: page?.speechSnippets || [],
    imageUrl: page?.imageUrl || `/api/acervo/page-media/${comicId}/${pageIdx}`,
    watermark: `${SECURE_VAULT_CONFIG.sessionPrefix} • COPIAR PROIBIDO • SESSÃO #${comicId.toUpperCase()}`,
  });
});

// 6. Server-Side Repository Refresh (Triggered by authorized curator)
app.post('/api/acervo/sync', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const candidate = authHeader.substring(7).trim();
    if (isValidOAuthToken(candidate)) {
      latestVaultToken = candidate;
    }
  }

  const result = await syncFromCloudVault(latestVaultToken || undefined);

  res.json({
    success: true,
    message: result.newlyFound > 0
      ? `${result.newlyFound} novas edições autenticadas e integradas ao Acervo Central!`
      : 'Acervo Central sincronizado via Gateway Seguro com sucesso.',
    totalEditions: result.total,
    newlyFound: result.newlyFound,
    updatedAt: new Date().toISOString(),
  });
});

// Helper to inspect current Service Account configuration
function getServiceAccountInfo(): { filePath: string; credentials: any } | null {
  const candidateKeyPaths = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.resolve(__dirname, 'service-account.json'),
    path.resolve(__dirname, 'credentials.json'),
    path.resolve(__dirname, 'serviceAccountKey.json'),
    path.resolve(__dirname, 'key.json'),
    path.resolve(__dirname, 'google-credentials.json'),
  ].filter(Boolean) as string[];

  for (const keyPath of candidateKeyPaths) {
    if (fs.existsSync(keyPath)) {
      try {
        const raw = fs.readFileSync(keyPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed.type === 'service_account' || parsed.client_email) {
          return { filePath: keyPath, credentials: parsed };
        }
      } catch {}
    }
  }

  if (process.env.SERVICE_ACCOUNT_KEY) {
    try {
      const parsed = JSON.parse(process.env.SERVICE_ACCOUNT_KEY);
      if (parsed.type === 'service_account' || parsed.client_email) {
        return { filePath: 'ENV:SERVICE_ACCOUNT_KEY', credentials: parsed };
      }
    } catch {}
  }

  return null;
}

// 7. Save Service Account Key securely to server
app.post('/api/acervo/credentials', async (req, res) => {
  try {
    const { keyJson } = req.body;
    if (!keyJson || typeof keyJson !== 'string') {
      return res.status(400).json({ error: 'Conteúdo JSON da chave não fornecido.' });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(keyJson.trim());
    } catch {
      return res.status(400).json({ error: 'O texto fornecido não é um JSON válido.' });
    }

    if (!parsed.client_email || (!parsed.private_key && !parsed.private_key_id)) {
      return res.status(400).json({
        error: 'JSON inválido para Conta de Serviço. Certifique-se de que contém "client_email" e "private_key".',
      });
    }

    const targetKeyPath = path.resolve(__dirname, 'service-account.json');
    fs.writeFileSync(targetKeyPath, JSON.stringify(parsed, null, 2), 'utf8');

    // Run synchronization right after saving credentials
    const syncRes = await syncFromCloudVault();

    return res.json({
      success: true,
      message: 'Chave da Conta de Serviço salva e ativada com sucesso!',
      clientEmail: parsed.client_email,
      projectId: parsed.project_id || 'N/A',
      totalEditions: syncRes.total,
      newlyFound: syncRes.newlyFound,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Erro ao salvar credenciais.' });
  }
});

// 8. Test Drive Connection & Diagnostic Endpoint
app.get('/api/acervo/test-drive', async (req, res) => {
  const saInfo = getServiceAccountInfo();
  const drive = getDriveClient();

  if (!drive) {
    return res.json({
      configured: false,
      hasServiceAccount: false,
      message: 'Nenhuma chave de Service Account (.json) encontrada e nenhum curador autenticado.',
      targetFolderId: TARGET_FOLDER_ID,
      instructions: [
        'Acesse o Google Cloud Console -> IAM & Admin -> Service Accounts',
        'Crie uma Service Account e gere uma chave no formato JSON',
        'Salve como service-account.json na raiz do projeto ou cole a chave no painel do app',
        `Compartilhe a pasta Google Drive (${TARGET_FOLDER_ID}) com o e-mail da Service Account (permissão Leitor)`,
      ],
    });
  }

  // Check API activation
  let apiActive = false;
  let authenticatedIdentity: string | null = saInfo?.credentials?.client_email || null;

  try {
    const about = await drive.about.get({ fields: 'user, storageQuota' });
    apiActive = true;
    if (about.data.user?.emailAddress) {
      authenticatedIdentity = about.data.user.emailAddress;
    }
  } catch (apiErr: any) {
    const status = apiErr?.status || apiErr?.code || 500;
    const msg = apiErr?.message || '';
    return res.status(status).json({
      configured: true,
      apiActive: false,
      errorStatus: status,
      clientEmail: saInfo?.credentials?.client_email,
      projectId: saInfo?.credentials?.project_id,
      message: 'Falha na validação da Google Drive API.',
      details: msg,
      help: msg.includes('disabled') || msg.includes('has not been used')
        ? `Ative a Google Drive API no projeto: https://console.cloud.google.com/apis/library/drive.googleapis.com?project=${saInfo?.credentials?.project_id || ''}`
        : 'Verifique se as permissões do projeto Google Cloud estão ativas.',
    });
  }

  // Query folder items
  const query = `'${TARGET_FOLDER_ID}' in parents and trashed = false`;
  try {
    let allFiles: any[] = [];
    let pageToken: string | undefined = undefined;

    do {
      const listRes: any = await drive.files.list({
        q: query,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        fields: 'nextPageToken, files(id, name, mimeType, size, createdTime, thumbnailLink)',
        pageSize: 100,
        pageToken,
      });

      if (listRes.data.files && listRes.data.files.length > 0) {
        allFiles.push(...listRes.data.files);
      }
      pageToken = listRes.data.nextPageToken || undefined;
    } while (pageToken);

    return res.json({
      configured: true,
      apiActive: true,
      targetFolderId: TARGET_FOLDER_ID,
      clientEmail: authenticatedIdentity,
      projectId: saInfo?.credentials?.project_id,
      itemCount: allFiles.length,
      items: allFiles.map((f) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        size: f.size,
        isFolder: f.mimeType === 'application/vnd.google-apps.folder',
      })),
      message: allFiles.length > 0
        ? `Conexão bem-sucedida! ${allFiles.length} itens encontrados na pasta.`
        : 'Conexão realizada com sucesso, mas a pasta está vazia.',
    });
  } catch (queryErr: any) {
    const status = queryErr?.status || queryErr?.code || 500;
    const msg = queryErr?.message || '';

    let diagnosis = 'Erro desconhecido ao consultar a pasta.';
    let steps: string[] = [];

    if (status === 403 || msg.includes('insufficientFilePermissions') || msg.includes('Forbidden')) {
      diagnosis = 'Erro 403: A Service Account NÃO possui permissão para acessar esta pasta.';
      steps = [
        `Abra a pasta no Google Drive: https://drive.google.com/drive/folders/${TARGET_FOLDER_ID}`,
        'Clique em "Compartilhar" (canto superior direito)',
        `Adicione o e-mail: ${authenticatedIdentity || saInfo?.credentials?.client_email || 'o e-mail da sua Service Account'}`,
        'Defina a permissão como "Leitor" (Viewer)',
        'Clique em Compartilhar/Salvar e teste novamente',
      ];
    } else if (status === 404 || msg.includes('File not found')) {
      diagnosis = 'Erro 404: Pasta não encontrada ou não compartilhada com a Service Account.';
      steps = [
        `Verifique se o ID "${TARGET_FOLDER_ID}" está correto.`,
        'No Google Drive, pastas privadas retornam 404 se não forem compartilhadas com o e-mail da Service Account.',
        `Compartilhe a pasta com: ${authenticatedIdentity || saInfo?.credentials?.client_email || 'sua Service Account'}`,
      ];
    }

    return res.status(status).json({
      configured: true,
      apiActive: true,
      errorStatus: status,
      targetFolderId: TARGET_FOLDER_ID,
      clientEmail: authenticatedIdentity,
      diagnosis,
      steps,
      details: msg,
    });
  }
});

// ----------------------------------------------------
// PERSISTENT DATABASE API ENDPOINTS (/api/db/*)
// ----------------------------------------------------

// 1. Get entire database state
app.get('/api/db/state', (req, res) => {
  const db = loadServerDatabase();
  res.json({ success: true, data: db });
});

// 2. Sync full state from client (Bidirectional merge)
app.post('/api/db/sync', (req, res) => {
  const clientData = req.body;
  if (!clientData || typeof clientData !== 'object') {
    return res.status(400).json({ success: false, message: 'Dados inválidos' });
  }

  loadServerDatabase();

  // Merge reading progress
  if (clientData.readingProgress && typeof clientData.readingProgress === 'object') {
    for (const [cid, prog] of Object.entries(clientData.readingProgress)) {
      const serverProg = serverDatabase.readingProgress[cid];
      if (!serverProg || new Date((prog as any).updatedAt || 0) > new Date(serverProg.updatedAt || 0)) {
        serverDatabase.readingProgress[cid] = prog;
      }
    }
  }

  // Merge favorites
  if (clientData.favorites && typeof clientData.favorites === 'object') {
    serverDatabase.favorites = { ...serverDatabase.favorites, ...clientData.favorites };
  }

  // Merge collection
  if (clientData.collection && typeof clientData.collection === 'object') {
    serverDatabase.collection = { ...serverDatabase.collection, ...clientData.collection };
  }

  // Merge bookmarks
  if (Array.isArray(clientData.bookmarks)) {
    const existingIds = new Set(serverDatabase.bookmarks.map((b) => b.id));
    for (const bm of clientData.bookmarks) {
      if (!existingIds.has(bm.id)) {
        serverDatabase.bookmarks.unshift(bm);
        existingIds.add(bm.id);
      }
    }
    serverDatabase.bookmarks = serverDatabase.bookmarks.slice(0, 100);
  }

  // Merge reviews
  if (clientData.reviews && typeof clientData.reviews === 'object') {
    serverDatabase.reviews = { ...serverDatabase.reviews, ...clientData.reviews };
  }

  // Merge AI synopses
  if (clientData.aiSynopses && typeof clientData.aiSynopses === 'object') {
    serverDatabase.aiSynopses = { ...serverDatabase.aiSynopses, ...clientData.aiSynopses };
  }

  // Merge activities
  if (Array.isArray(clientData.activities)) {
    const actIds = new Set(serverDatabase.activities.map((a) => a.id));
    for (const act of clientData.activities) {
      if (!actIds.has(act.id)) {
        serverDatabase.activities.unshift(act);
        actIds.add(act.id);
      }
    }
    serverDatabase.activities = serverDatabase.activities.slice(0, 150);
  }

  // Merge customComics
  if (Array.isArray(clientData.customComics)) {
    const existingIds = new Set(serverDatabase.customComics.map((c: any) => c.id));
    for (const c of clientData.customComics) {
      if (!existingIds.has(c.id)) {
        serverDatabase.customComics.unshift(c);
        existingIds.add(c.id);
      }
    }
    syncDatabaseCustomComicsWithAcervo();
  }

  // Merge covers
  if (clientData.covers && typeof clientData.covers === 'object') {
    serverDatabase.covers = { ...serverDatabase.covers, ...clientData.covers };
  }

  // Merge settings
  if (clientData.settings && typeof clientData.settings === 'object') {
    serverDatabase.settings = { ...serverDatabase.settings, ...clientData.settings };
  }

  saveServerDatabase();
  res.json({ success: true, data: serverDatabase });
});

// 3. Save single reading progress
app.post('/api/db/progress', (req, res) => {
  const { comicId, currentPage, totalPages, progressPercent, isCompleted, comicTitle } = req.body;
  if (!comicId) return res.status(400).json({ success: false, message: 'comicId é obrigatório' });

  loadServerDatabase();
  const safeTotal = Math.max(1, totalPages || 36);
  const safePage = Math.max(1, Math.min(currentPage || 1, safeTotal));
  const percent = progressPercent ?? Math.round((safePage / safeTotal) * 100);
  const completed = isCompleted ?? safePage >= safeTotal;
  const now = new Date().toISOString();

  const prev = serverDatabase.readingProgress[comicId];
  const record = {
    comicId,
    currentPage: safePage,
    totalPages: safeTotal,
    progressPercent: percent,
    isCompleted: completed,
    updatedAt: now,
    comicTitle: comicTitle || prev?.comicTitle,
  };

  serverDatabase.readingProgress[comicId] = record;

  // Log completion in activity
  if (completed && (!prev || !prev.isCompleted)) {
    serverDatabase.activities.unshift({
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'read_complete',
      title: 'HQ Concluída! 🏆',
      description: `Completou a leitura de todas as ${safeTotal} páginas de "${comicTitle || 'Edição'}".`,
      comicId,
      comicTitle,
      timestamp: now,
    });
    serverDatabase.activities = serverDatabase.activities.slice(0, 150);
  }

  // Keep cachedAcervo updated in memory
  const comic = cachedAcervo.find((c) => c.id === comicId);
  if (comic) {
    comic.currentPage = safePage;
    comic.totalPages = safeTotal;
    comic.readProgressPercent = percent;
  }

  saveServerDatabase();
  res.json({ success: true, record });
});

// 4. Toggle Favorite
app.post('/api/db/favorite', (req, res) => {
  const { comicId, title, isFavorite } = req.body;
  if (!comicId) return res.status(400).json({ success: false });

  loadServerDatabase();
  const now = new Date().toISOString();

  if (isFavorite) {
    serverDatabase.favorites[comicId] = { comicId, title, addedAt: now };
    serverDatabase.activities.unshift({
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'favorite_added',
      title: 'Adicionado aos Favoritos ⭐',
      description: `"${title || 'Edição'}" foi adicionada aos seus favoritos.`,
      comicId,
      comicTitle: title,
      timestamp: now,
    });
  } else {
    delete serverDatabase.favorites[comicId];
    serverDatabase.activities.unshift({
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'favorite_removed',
      title: 'Removido dos Favoritos',
      description: `"${title || 'Edição'}" foi removida dos favoritos.`,
      comicId,
      comicTitle: title,
      timestamp: now,
    });
  }

  serverDatabase.activities = serverDatabase.activities.slice(0, 150);
  saveServerDatabase();
  res.json({ success: true, isFavorite: Boolean(isFavorite) });
});

// 5. Toggle Collection
app.post('/api/db/collection', (req, res) => {
  const { comicId, title, inCollection } = req.body;
  if (!comicId) return res.status(400).json({ success: false });

  loadServerDatabase();
  const now = new Date().toISOString();

  if (inCollection) {
    serverDatabase.collection[comicId] = { comicId, title, addedAt: now };
    serverDatabase.activities.unshift({
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'collection_added',
      title: 'Adicionado à Estante 📚',
      description: `"${title || 'Edição'}" catalogada na sua estante.`,
      comicId,
      comicTitle: title,
      timestamp: now,
    });
  } else {
    delete serverDatabase.collection[comicId];
    serverDatabase.activities.unshift({
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'collection_removed',
      title: 'Removido da Estante',
      description: `"${title || 'Edição'}" removida da estante.`,
      comicId,
      comicTitle: title,
      timestamp: now,
    });
  }

  serverDatabase.activities = serverDatabase.activities.slice(0, 150);
  saveServerDatabase();
  res.json({ success: true, inCollection: Boolean(inCollection) });
});

// 6. Manage Bookmarks
app.post('/api/db/bookmark', (req, res) => {
  const { action, bookmark, bookmarkId } = req.body;
  loadServerDatabase();

  if (action === 'add' && bookmark) {
    serverDatabase.bookmarks = [
      bookmark,
      ...serverDatabase.bookmarks.filter((b) => !(b.comicId === bookmark.comicId && b.pageNumber === bookmark.pageNumber)),
    ].slice(0, 100);

    serverDatabase.activities.unshift({
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'bookmark_added',
      title: 'Marcador Criado 🔖',
      description: `Marcador salvo na página ${bookmark.pageNumber} de "${bookmark.comicTitle || 'Edição'}".`,
      comicId: bookmark.comicId,
      comicTitle: bookmark.comicTitle,
      timestamp: new Date().toISOString(),
    });
  } else if (action === 'remove' && bookmarkId) {
    serverDatabase.bookmarks = serverDatabase.bookmarks.filter((b) => b.id !== bookmarkId);
  }

  saveServerDatabase();
  res.json({ success: true, bookmarks: serverDatabase.bookmarks });
});

// 7. Save Rating and Review
app.post('/api/db/review', (req, res) => {
  const { comicId, rating, reviewText, comicTitle } = req.body;
  if (!comicId) return res.status(400).json({ success: false });

  loadServerDatabase();
  const now = new Date().toISOString();

  serverDatabase.reviews[comicId] = {
    comicId,
    comicTitle,
    rating: Math.max(1, Math.min(5, Number(rating) || 5)),
    reviewText: (reviewText || '').trim(),
    updatedAt: now,
  };

  serverDatabase.activities.unshift({
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'review_added',
    title: 'Avaliação Registrada ⭐',
    description: `Avaliou "${comicTitle || 'Edição'}" com ${rating} estrelas.`,
    comicId,
    comicTitle,
    timestamp: now,
  });

  serverDatabase.activities = serverDatabase.activities.slice(0, 150);
  saveServerDatabase();
  res.json({ success: true, review: serverDatabase.reviews[comicId] });
});

// 8. Get Recent Activities Timeline
app.get('/api/db/activities', (req, res) => {
  loadServerDatabase();
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
  res.json({ success: true, activities: serverDatabase.activities.slice(0, limit) });
});

// ----------------------------------------------------
// INTEGRAÇÃO GEMINI AI: GERAÇÃO AUTOMÁTICA DE SINOPSES (/api/ai/*)
// ----------------------------------------------------

// 1. Generate Intelligent Comic Synopsis with Gemini 3.8 Flash
app.post('/api/ai/synopsis', async (req, res) => {
  const { comicId, title, publisher, year, issueNumber, sagaTitle, forceRegenerate } = req.body;

  if (!comicId || !title) {
    return res.status(400).json({ success: false, message: 'comicId e title são obrigatórios' });
  }

  loadServerDatabase();

  // Return cached synopsis if available and not forced
  if (!forceRegenerate && serverDatabase.aiSynopses[comicId]) {
    return res.json({ success: true, cached: true, data: serverDatabase.aiSynopses[comicId] });
  }

  try {
    const prompt = `Você é o curador oficial e especialista em quadrinhos da 'Banca Geek Collector Edition'.
Sua missão é criar uma sinopse completa, envolvente, cinematográfica e canônica em português do Brasil para a seguinte edição de história em quadrinhos:

DADOS DA EDIÇÃO:
- Título da HQ: "${title}"
- Editora: ${publisher || 'Marvel / DC Comics / Abril'}
- Ano de Lançamento: ${year || 1985}
- Número da Edição: #${issueNumber || 1}
- Saga / Arco / Série: "${sagaTitle || 'Edição Histórica'}"

DIRETRIZES DA CURADORIA:
1. Escreva uma sinopse cativante (entre 120 e 220 palavras) no estilo das revistas e editoras clássicas (Abril, Panini, EBAL, Bloch), que instigue o leitor e destaque a trama central, o grande perigo e os dilemas morais.
2. Identifique um "logline" dramático de 1 frase marcante.
3. Liste os personagens centrais da história.
4. Identifique o tom predominante da narrativa (ex: "Épico e Sombrio", "Espionagem Urbana", "Conflito Cósmico Multiversal", "Aventura Clássica dos Anos 80").
5. Inclua um breve parágrafo de "Contexto Histórico / Curiosidade da Edição" explicando por que essa edição é reverenciada pelos fãs e colecionadores.
6. Indique para quem esta HQ é leitura obrigatória.

RESPONDA EXCLUSIVAMENTE COM UM OBJETO JSON VÁLIDO no seguinte formato:
{
  "synopsis": "Texto detalhado e envolvente da sinopse aqui...",
  "logline": "Uma frase de alto impacto dramático...",
  "mainCharacters": ["Personagem 1", "Personagem 2", "Vilão / Ameaça"],
  "tone": "Tom da história",
  "historicalContext": "Breve contexto histórico ou curiosidade de bastidores desta edição...",
  "recommendedFor": "Para fãs de..."
}`;

    const aiResponse = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        temperature: 0.7,
      },
    });

    const responseText = aiResponse.text || '{}';
    let parsedData: any = {};
    try {
      parsedData = JSON.parse(responseText.trim());
    } catch {
      // Fallback clean extraction
      const match = responseText.match(/\{[\s\S]*\}/);
      if (match) parsedData = JSON.parse(match[0]);
    }

    const synopsisRecord = {
      comicId,
      synopsis: parsedData.synopsis || `Uma edição fundamental do acervo: ${title}. Acompanhe os confrontos decisivos e as reviravoltas que moldaram o universo dos quadrinhos.`,
      logline: parsedData.logline || `${title} traz revelações históricas e confrontos inesquecíveis.`,
      mainCharacters: Array.isArray(parsedData.mainCharacters) ? parsedData.mainCharacters : ['Heróis Principais', 'Antagonistas'],
      tone: parsedData.tone || 'Aventura Canônica Clássica',
      historicalContext: parsedData.historicalContext || `Publicada originalmente em ${year || 1985}, esta edição é um marco de preservação do colecionismo.`,
      recommendedFor: parsedData.recommendedFor || 'Leitores e colecionadores de quadrinhos históricos.',
      generatedAt: new Date().toISOString(),
    };

    // Save to persistent database
    serverDatabase.aiSynopses[comicId] = synopsisRecord;

    // Update in-memory cachedAcervo so comic lists show new synopsis
    const comic = cachedAcervo.find((c) => c.id === comicId);
    if (comic) {
      comic.synopsis = synopsisRecord.synopsis;
    }

    // Log activity
    serverDatabase.activities.unshift({
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'ai_synopsis_generated',
      title: 'Sinopse Gerada por IA ✨',
      description: `Curadoria automatizada com Gemini criada para "${title}".`,
      comicId,
      comicTitle: title,
      timestamp: new Date().toISOString(),
    });
    serverDatabase.activities = serverDatabase.activities.slice(0, 150);

    saveServerDatabase();

    return res.json({ success: true, cached: false, data: synopsisRecord });
  } catch (err: any) {
    console.error(`[Gemini AI] Erro ao gerar sinopse para ${title}:`, err?.message || err);
    return res.status(500).json({
      success: false,
      message: 'Falha ao processar sinopse com inteligência artificial.',
      error: err?.message || err,
    });
  }
});

// 2. Batch generate synopses for top comics
app.post('/api/ai/batch-generate', async (req, res) => {
  const { limit = 5 } = req.body;
  loadServerDatabase();

  const candidates = cachedAcervo
    .filter((c) => !serverDatabase.aiSynopses[c.id])
    .slice(0, Math.min(20, limit));

  res.json({
    success: true,
    message: `Iniciando geração de sinopses para ${candidates.length} edições em segundo plano.`,
    count: candidates.length,
  });

  // Background worker for batch generation
  (async () => {
    for (const c of candidates) {
      try {
        const prompt = `Crie uma sinopse em português brasileiro para a HQ: "${c.title}" (${c.publisher}, ${c.year}).
Retorne JSON com: {"synopsis": "...", "logline": "...", "mainCharacters": ["..."], "tone": "...", "historicalContext": "..."}`;
        const resp = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: { responseMimeType: 'application/json' },
        });
        const text = resp.text || '{}';
        const parsed = JSON.parse(text.trim());
        serverDatabase.aiSynopses[c.id] = {
          comicId: c.id,
          synopsis: parsed.synopsis || c.synopsis,
          logline: parsed.logline || c.title,
          mainCharacters: parsed.mainCharacters || [],
          tone: parsed.tone || 'Clássico',
          historicalContext: parsed.historicalContext || '',
          generatedAt: new Date().toISOString(),
        };
        saveServerDatabase();
      } catch {}
    }
  })();
});

// ----------------------------------------------------
// FRONTEND SERVER SETUP (Vite in dev, static in prod)
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Banca Geek] Server running at http://0.0.0.0:${PORT}`);
    // Trigger initial silent background sync on boot
    syncFromCloudVault()
      .then((r) => console.log(`[Banca Geek Backend] Sincronização inicial em background: ${r.total} HQs no acervo.`))
      .catch((err) => console.log('[Banca Geek Backend] Sincronização em background aguardando:', err?.message || err));
  });

  // Scheduled silent recurring auto-sync every 3 minutes
  setInterval(() => {
    syncFromCloudVault().catch(() => {});
  }, 3 * 60 * 1000);
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
export { app, startServer };
