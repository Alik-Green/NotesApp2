import { PDFDocument, rgb, PDFPage } from 'pdf-lib';
import { getStroke } from 'perfect-freehand';
import type { Notebook, Page } from './types';
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  const v = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return { r: ((v >> 16) & 255) / 255, g: ((v >> 8) & 255) / 255, b: (v & 255) / 255 };
}
export function outlineToSvgPath(points: number[][]): string {
  if (!points.length) return '';
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ') + ' Z';
}
export async function exportNotebookToPdf(notebook: Notebook, pages: Page[], pdfSources: Map<string, ArrayBuffer>): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  const sources = new Map<string, PDFDocument>();
  for (const page of pages) {
    let pdfPage: PDFPage;
    if (page.background.kind === 'pdf') {
      const srcBytes = pdfSources.get(page.background.pdfId);
      if (srcBytes) {
        if (!sources.has(page.background.pdfId)) sources.set(page.background.pdfId, await PDFDocument.load(srcBytes.slice(0)));
        const src = sources.get(page.background.pdfId)!;
        const [copied] = await out.copyPages(src, [page.background.pageIndex]);
        pdfPage = out.addPage(copied);
      } else pdfPage = out.addPage([page.width, page.height]);
    } else pdfPage = out.addPage([page.width, page.height]);
    const { height } = pdfPage.getSize();
    // Flip Y: canvas origin top-left, PDF bottom-left. drawSvgPath uses PDF coords with its own transform; use translate via path in top-left by drawing with negative? pdf-lib drawSvgPath y is from bottom with path y down? We pre-flip points.
    for (const s of page.strokes) {
      const outline = getStroke(s.points.map((p) => [p.x, height - p.y, p.pressure] as [number, number, number]), { size: s.size, thinning: s.tool === 'pen' ? 0.6 : 0, smoothing: 0.5, streamline: 0.5, simulatePressure: false });
      const path = outlineToSvgPath(outline as number[][]);
      if (!path) continue;
      const c = hexToRgb(s.color);
      pdfPage.drawSvgPath(path, { color: rgb(c.r, c.g, c.b), opacity: s.tool === 'highlighter' ? 0.35 : 1 });
    }
  }
  void notebook;
  return out.save();
}
