export type TemplateKind = 'blank' | 'lined' | 'grid';
export type Tool = 'pen' | 'highlighter' | 'eraser' | 'pan';
export type PageBackground =
  | { kind: 'template'; template: TemplateKind }
  | { kind: 'pdf'; pdfId: string; pageIndex: number; width: number; height: number };
export interface InkPoint { x: number; y: number; pressure: number; tiltX?: number; tiltY?: number; t?: number }
export interface Stroke { id: string; pageId: string; tool: 'pen' | 'highlighter'; color: string; size: number; points: InkPoint[]; createdAt: number }
export interface Page { id: string; notebookId: string; width: number; height: number; background: PageBackground; strokes: Stroke[] }
export interface Notebook { id: string; title: string; createdAt: number; updatedAt: number }
export interface PdfRecord { id: string; name: string; data: ArrayBuffer; pageCount: number }
export const A4 = { width: 794, height: 1123 };
