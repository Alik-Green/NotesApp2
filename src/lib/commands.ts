import type { Page, Stroke } from './types';
export interface Doc { pages: Page[] }
export type Command =
  | { type: 'addStroke'; stroke: Stroke }
  | { type: 'removeStrokes'; pageId: string; strokes: Stroke[] }
  | { type: 'addPage'; page: Page; index: number }
  | { type: 'deletePage'; page: Page; index: number }
  | { type: 'reorderPages'; from: number; to: number }
  | { type: 'batch'; label: string; commands: Command[] };

export function applyCommand(doc: Doc, cmd: Command): void {
  switch (cmd.type) {
    case 'addStroke': { const p = doc.pages.find((x) => x.id === cmd.stroke.pageId); if (p && !p.strokes.some((s) => s.id === cmd.stroke.id)) p.strokes.push(cmd.stroke); break; }
    case 'removeStrokes': { const p = doc.pages.find((x) => x.id === cmd.pageId); if (p) { const ids = new Set(cmd.strokes.map((s) => s.id)); p.strokes = p.strokes.filter((s) => !ids.has(s.id)); } break; }
    case 'addPage': if (!doc.pages.some((p) => p.id === cmd.page.id)) doc.pages.splice(Math.min(cmd.index, doc.pages.length), 0, cmd.page); break;
    case 'deletePage': doc.pages = doc.pages.filter((p) => p.id !== cmd.page.id); break;
    case 'reorderPages': { const [m] = doc.pages.splice(cmd.from, 1); if (m) doc.pages.splice(cmd.to, 0, m); break; }
    case 'batch': cmd.commands.forEach((c) => applyCommand(doc, c)); break;
  }
}
export function revertCommand(doc: Doc, cmd: Command): void {
  switch (cmd.type) {
    case 'addStroke': { const p = doc.pages.find((x) => x.id === cmd.stroke.pageId); if (p) p.strokes = p.strokes.filter((s) => s.id !== cmd.stroke.id); break; }
    case 'removeStrokes': { const p = doc.pages.find((x) => x.id === cmd.pageId); if (p) for (const s of cmd.strokes) if (!p.strokes.some((x) => x.id === s.id)) p.strokes.push(s); break; }
    case 'addPage': doc.pages = doc.pages.filter((p) => p.id !== cmd.page.id); break;
    case 'deletePage': if (!doc.pages.some((p) => p.id === cmd.page.id)) doc.pages.splice(Math.min(cmd.index, doc.pages.length), 0, cmd.page); break;
    case 'reorderPages': { const [m] = doc.pages.splice(cmd.to, 1); if (m) doc.pages.splice(cmd.from, 0, m); break; }
    case 'batch': [...cmd.commands].reverse().forEach((c) => revertCommand(doc, c)); break;
  }
}
export class CommandStack {
  undoStack: Command[] = [];
  redoStack: Command[] = [];
  constructor(private limit = 200) {}
  get canUndo(): boolean { return this.undoStack.length > 0; }
  get canRedo(): boolean { return this.redoStack.length > 0; }
  execute(doc: Doc, cmd: Command): void { applyCommand(doc, cmd); this.undoStack.push(cmd); if (this.undoStack.length > this.limit) this.undoStack.shift(); this.redoStack = []; }
  /** Push an already-applied change (e.g. a batched eraser drag) as one step. */
  pushApplied(cmd: Command): void { this.undoStack.push(cmd); if (this.undoStack.length > this.limit) this.undoStack.shift(); this.redoStack = []; }
  undo(doc: Doc): boolean { const c = this.undoStack.pop(); if (!c) return false; revertCommand(doc, c); this.redoStack.push(c); return true; }
  redo(doc: Doc): boolean { const c = this.redoStack.pop(); if (!c) return false; applyCommand(doc, c); this.undoStack.push(c); return true; }
  clear(): void { this.undoStack = []; this.redoStack = []; }
  serialize(): string { return JSON.stringify({ undo: this.undoStack, redo: this.redoStack }); }
  static deserialize(json: string | undefined, limit = 200): CommandStack {
    const s = new CommandStack(limit);
    if (!json) return s;
    try { const d = JSON.parse(json) as { undo: Command[]; redo: Command[] }; s.undoStack = (d.undo || []).slice(-limit); s.redoStack = d.redo || []; } catch { /* corrupted history is non-fatal */ }
    return s;
  }
}
