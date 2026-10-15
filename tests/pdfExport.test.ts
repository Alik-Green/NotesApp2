import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { exportNotebookToPdf } from '../src/lib/pdfExport';
import type { Page } from '../src/lib/types';
describe('pdf export', () => {
  it('export page count matches notebook pages incl. ink', async () => {
    const pages: Page[] = [0, 1].map((i) => ({ id: 'p' + i, notebookId: 'n', width: 595, height: 842, background: { kind: 'template', template: 'blank' }, strokes: [{ id: 's' + i, pageId: 'p' + i, tool: 'pen', color: '#ff0000', size: 4, createdAt: 1, points: [{ x: 10, y: 10, pressure: .5 }, { x: 100, y: 100, pressure: .8 }] }] }));
    const bytes = await exportNotebookToPdf({ id: 'n', title: 't', createdAt: 1, updatedAt: 1 }, pages, new Map());
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(2);
  });
  it('copies original PDF pages', async () => {
    const src = await PDFDocument.create(); src.addPage([200, 200]); src.addPage([200, 200]);
    const srcBytes = await src.save();
    const pages: Page[] = [{ id: 'p', notebookId: 'n', width: 200, height: 200, background: { kind: 'pdf', pdfId: 'pdf1', pageIndex: 1, width: 200, height: 200 }, strokes: [] }];
    const bytes = await exportNotebookToPdf({ id: 'n', title: 't', createdAt: 1, updatedAt: 1 }, pages, new Map([['pdf1', srcBytes.buffer as ArrayBuffer]]));
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });
});
