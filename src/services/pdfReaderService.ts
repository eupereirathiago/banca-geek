import * as pdfjsLib from 'pdfjs-dist';

// Configure the worker for pdfjs in browser with robust CDN fallback
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs`;
  } catch {
    // Worker initialization fallback
  }
}

export interface LoadedPdfDoc {
  doc: any;
  numPages: number;
}

const pdfDocCache = new Map<string, Promise<LoadedPdfDoc | null>>();

/**
 * Loads a PDF document in memory from an internal binary stream or URL
 */
export async function loadPdfDocument(sourceUrl: string): Promise<LoadedPdfDoc | null> {
  if (pdfDocCache.has(sourceUrl)) {
    return pdfDocCache.get(sourceUrl)!;
  }

  const promise = (async () => {
    try {
      const resp = await fetch(sourceUrl);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      const arrayBuffer = await resp.arrayBuffer();
      if (!arrayBuffer || arrayBuffer.byteLength < 100) {
        throw new Error('Arquivo PDF vazio ou inválido recebido');
      }

      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(arrayBuffer),
        cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/cmaps/',
        cMapPacked: true,
      });

      const doc = await loadingTask.promise;
      return { doc, numPages: doc.numPages };
    } catch (err: any) {
      console.warn('[PdfReaderService] Erro ao carregar PDF:', err?.message || err);
      return null;
    }
  })();

  pdfDocCache.set(sourceUrl, promise);
  return promise;
}

/**
 * Renders a specific page of a loaded PDF document to an HTML5 canvas
 */
export async function renderPdfPageToCanvas(
  doc: any,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale: number = 1.5
): Promise<boolean> {
  try {
    if (!doc || !canvas) return false;
    const boundedPage = Math.max(1, Math.min(pageNumber, doc.numPages));
    const page = await doc.getPage(boundedPage);
    const viewport = page.getViewport({ scale });

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    // Clear previous drawing
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const renderContext = {
      canvasContext: ctx,
      viewport: viewport,
    };

    await page.render(renderContext).promise;
    return true;
  } catch (err: any) {
    console.warn(`[PdfReaderService] Erro ao renderizar página ${pageNumber}:`, err?.message || err);
    return false;
  }
}
