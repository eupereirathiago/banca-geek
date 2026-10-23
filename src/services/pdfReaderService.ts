import * as pdfjsLib from 'pdfjs-dist';

// Configure the worker for pdfjs in browser
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs`;
}

interface LoadedPdfDoc {
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
      const loadingTask = pdfjsLib.getDocument({
        url: sourceUrl,
        withCredentials: false,
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
    const page = await doc.getPage(pageNumber);
    const viewport = page.getViewport({ scale });

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

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
