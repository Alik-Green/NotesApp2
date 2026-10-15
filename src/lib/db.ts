import Dexie, { type Table } from 'dexie';
import type { Notebook, Page, PdfRecord } from './types';
import { serializeStroke, deserializeStroke, type CompactStroke } from './serialization';
export interface NotebookRow extends Notebook { pageIds: string[] }
export interface PageRow { id: string; notebookId: string; order: number; width: number; height: number; background: Page['background']; strokes: CompactStroke[] }
export interface PdfRow extends PdfRecord {}
export interface MetaRow { key: string; value: string }
class InkPadDB extends Dexie {
  notebooks!: Table<NotebookRow, string>;
  pages!: Table<PageRow, string>;
  pdfs!: Table<PdfRow, string>;
  meta!: Table<MetaRow, string>;
  constructor() {
    super('inkpad');
    this.version(1).stores({ notebooks: 'id, updatedAt', pages: 'id, notebookId, [notebookId+order]', pdfs: 'id', meta: 'key' });
  }
}
export const db = new InkPadDB();
export async function listNotebooks(): Promise<NotebookRow[]> { return db.notebooks.orderBy('updatedAt').reverse().toArray(); }
export async function saveNotebook(nb: NotebookRow, pages: Page[]): Promise<void> {
  await db.transaction('rw', db.notebooks, db.pages, async () => {
    await db.notebooks.put(nb);
    await db.pages.where('notebookId').equals(nb.id).delete();
    await db.pages.bulkPut(pages.map((p, i) => ({ id: p.id, notebookId: nb.id, order: i, width: p.width, height: p.height, background: p.background, strokes: p.strokes.map(serializeStroke) })));
  });
}
export async function loadPages(notebookId: string): Promise<Page[]> {
  const rows = await db.pages.where('notebookId').equals(notebookId).sortBy('order');
  return rows.map((r) => ({ id: r.id, notebookId: r.notebookId, width: r.width, height: r.height, background: r.background, strokes: r.strokes.map(deserializeStroke) }));
}
export async function deleteNotebook(id: string): Promise<void> {
  await db.transaction('rw', db.notebooks, db.pages, db.meta, async () => {
    await db.notebooks.delete(id); await db.pages.where('notebookId').equals(id).delete(); await db.meta.delete(`history:${id}`);
  });
}
export async function saveHistory(notebookId: string, json: string): Promise<void> { await db.meta.put({ key: `history:${notebookId}`, value: json }); }
export async function loadHistory(notebookId: string): Promise<string | undefined> { return (await db.meta.get(`history:${notebookId}`))?.value; }
export async function savePdf(rec: PdfRecord): Promise<void> { await db.pdfs.put(rec); }
export async function getPdf(id: string): Promise<PdfRecord | undefined> { return db.pdfs.get(id); }
