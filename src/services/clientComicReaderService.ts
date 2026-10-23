import JSZip from 'jszip';
import { ComicIssue } from '../types/comic';

// In-memory cache of extracted page blob URLs per comic ID
const extractedBlobCache = new Map<string, string[]>();
const extractionInFlight = new Map<string, Promise<string[] | null>>();

export interface ClientExtractionProgress {
  status: 'idle' | 'downloading' | 'extracting' | 'ready' | 'error';
  progressPercent: number;
  message: string;
}

/**
 * Downloads a CBZ/ZIP archive directly from Google Drive in the user's browser (with CORS)
 * and extracts all page images into high-performance Blob URLs.
 */
export async function extractComicPagesInBrowser(
  comic: ComicIssue,
  onProgress?: (progress: ClientExtractionProgress) => void
): Promise<string[] | null> {
  const cached = extractedBlobCache.get(comic.id);
  if (cached && cached.length > 0) {
    if (onProgress) onProgress({ status: 'ready', progressPercent: 100, message: 'Pronto!' });
    return cached;
  }

  if (extractionInFlight.has(comic.id)) {
    return extractionInFlight.get(comic.id)!;
  }

  const promise = (async () => {
    try {
      const driveFileId = comic.driveFileId;
      if (!driveFileId && !comic.driveDownloadUrl) {
        return null;
      }

      const downloadUrl =
        comic.driveDownloadUrl ||
        `https://drive.usercontent.google.com/download?id=${driveFileId}&export=download&confirm=t`;

      if (onProgress) {
        onProgress({ status: 'downloading', progressPercent: 15, message: 'Carregando arquivo do Google Drive...' });
      }

      const res = await fetch(downloadUrl, { mode: 'cors' });
      if (!res.ok) {
        throw new Error(`Falha no download: status ${res.status}`);
      }

      if (onProgress) {
        onProgress({ status: 'extracting', progressPercent: 65, message: 'Descompactando páginas da HQ...' });
      }

      const arrayBuffer = await res.arrayBuffer();
      if (!arrayBuffer || arrayBuffer.byteLength < 100) {
        throw new Error('Arquivo vazio ou inválido recebido do Drive');
      }

      // Try Unzipping with JSZip (Works for all .cbz and .zip)
      const zip = await JSZip.loadAsync(arrayBuffer);
      const imageFiles: Array<{ name: string; file: JSZip.JSZipObject }> = [];

      zip.forEach((relativePath, file) => {
        if (
          !file.dir &&
          /\.(jpe?g|png|webp|gif|bmp)$/i.test(relativePath) &&
          !relativePath.includes('__MACOSX') &&
          !relativePath.startsWith('._')
        ) {
          imageFiles.push({ name: relativePath, file });
        }
      });

      if (imageFiles.length === 0) {
        return null;
      }

      // Sort naturally by page filename (e.g. 001.jpg, 002.jpg)
      imageFiles.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
      );

      const blobUrls: string[] = [];
      for (let i = 0; i < imageFiles.length; i++) {
        const item = imageFiles[i];
        const blob = await item.file.async('blob');
        const url = URL.createObjectURL(blob);
        blobUrls.push(url);
      }

      extractedBlobCache.set(comic.id, blobUrls);
      if (onProgress) {
        onProgress({ status: 'ready', progressPercent: 100, message: `${blobUrls.length} páginas carregadas!` });
      }
      return blobUrls;
    } catch (err: any) {
      console.warn(`[Client Reader] Não foi possível extrair ${comic.title} via JSZip:`, err?.message || err);
      if (onProgress) {
        onProgress({ status: 'error', progressPercent: 0, message: 'Usando visualizador oficial do Drive.' });
      }
      return null;
    } finally {
      extractionInFlight.delete(comic.id);
    }
  })();

  extractionInFlight.set(comic.id, promise);
  return promise;
}

/**
 * Returns cached blob URLs if already extracted
 */
export function getCachedComicBlobUrls(comicId: string): string[] | null {
  return extractedBlobCache.get(comicId) || null;
}
