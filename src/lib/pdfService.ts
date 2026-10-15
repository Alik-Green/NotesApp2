import * as pdfjsLib from 'pdfjs-dist';
// Vite worker wiring
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
const cache = new Map<string, Promise<pdfjsLib.PDFDocumentProxy>>();
export function loadPdf(id: string, data: ArrayBuffer): Promise<pdfjsLib.PDFDocumentProxy> {
  if (!cache.has(id)) cache.set(id, pdfjsLib.getDocument({ data: data.slice(0) }).promise);
  const p = cache.get(id);
  if (!p) throw new Error('pdf load failed');
  return p;
}
export async function renderPdfPage(canvas: HTMLCanvasElement, pdfId: string, data: ArrayBuffer, pageIndex: number, scale: number): Promise<(() => void) | undefined> {
  const doc = await loadPdf(pdfId, data);
  const page = await doc.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale });
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(viewport.width * dpr); canvas.height = Math.floor(viewport.height * dpr);
  canvas.style.width = `${viewport.width}px`; canvas.style.height = `${viewport.height}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const task = page.render({ canvasContext: ctx, viewport });
  try { await task.promise; } catch { return undefined; }
  return () => task.cancel();
}
