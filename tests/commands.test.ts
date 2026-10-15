import { describe, it, expect } from 'vitest';
import { CommandStack, type Doc } from '../src/lib/commands';
import type { Page, Stroke } from '../src/lib/types';
const page = (id: string): Page => ({ id, notebookId: 'n', width: 100, height: 100, background: { kind: 'template', template: 'blank' }, strokes: [] });
const stroke = (id: string, pageId: string): Stroke => ({ id, pageId, tool: 'pen', color: '#000', size: 3, points: [{ x: 1, y: 1, pressure: .5 }], createdAt: 1 });
describe('CommandStack', () => {
  it('undo/redo addStroke', () => {
    const doc: Doc = { pages: [page('p1')] }; const st = new CommandStack();
    st.execute(doc, { type: 'addStroke', stroke: stroke('s1', 'p1') });
    expect(doc.pages[0].strokes).toHaveLength(1);
    expect(st.undo(doc)).toBe(true); expect(doc.pages[0].strokes).toHaveLength(0);
    expect(st.redo(doc)).toBe(true); expect(doc.pages[0].strokes).toHaveLength(1);
  });
  it('one eraser drag = one undo step (batch remove)', () => {
    const doc: Doc = { pages: [page('p1')] }; const st = new CommandStack();
    const ss = [stroke('a', 'p1'), stroke('b', 'p1')]; ss.forEach((x) => st.execute(doc, { type: 'addStroke', stroke: x }));
    doc.pages[0].strokes = []; st.pushApplied({ type: 'removeStrokes', pageId: 'p1', strokes: ss });
    expect(st.undo(doc)).toBe(true); expect(doc.pages[0].strokes).toHaveLength(2);
    expect(st.redo(doc)).toBe(true); expect(doc.pages[0].strokes).toHaveLength(0);
  });
  it('caps history and serializes', () => {
    const doc: Doc = { pages: [page('p1')] }; const st = new CommandStack(3);
    for (let i = 0; i < 5; i++) st.execute(doc, { type: 'addStroke', stroke: stroke('s' + i, 'p1') });
    expect(st.undoStack.length).toBe(3);
    const restored = CommandStack.deserialize(st.serialize());
    expect(restored.canUndo).toBe(true);
  });
  it('add/delete/reorder page reversible', () => {
    const doc: Doc = { pages: [page('p1')] }; const st = new CommandStack();
    st.execute(doc, { type: 'addPage', page: page('p2'), index: 1 });
    st.execute(doc, { type: 'reorderPages', from: 1, to: 0 });
    expect(doc.pages.map((p) => p.id)).toEqual(['p2', 'p1']);
    st.undo(doc); expect(doc.pages.map((p) => p.id)).toEqual(['p1', 'p2']);
    st.execute(doc, { type: 'deletePage', page: doc.pages[1], index: 1 });
    expect(doc.pages).toHaveLength(1); st.undo(doc); expect(doc.pages).toHaveLength(2);
  });
});
