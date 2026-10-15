import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import PageCanvas from './PageCanvas';
import { A4, type TemplateKind, type Tool } from '../lib/types';
import { newId } from '../lib/id';
import { saveNotebook, saveHistory, getPdf } from '../lib/db';
import { exportNotebookToPdf } from '../lib/pdfExport';

const PALETTE = ['#111827', '#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#ffffff'];
export default function Editor() {
  const s = useStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState<Set<string>>(new Set());
  const [template, setTemplate] = useState<TemplateKind>('blank');
  const saveTimer = useRef<number>(0);
  const pagesRef = useRef<HTMLDivElement>(null);

  const persist = useCallback(async () => {
    const st = useStore.getState(); if (!st.current) return;
    const nb = { ...st.current, pageIds: st.pages.map((p) => p.id), updatedAt: Date.now() };
    await saveNotebook(nb, st.pages); await saveHistory(st.current.id, st.stack.serialize());
  }, []);
  useEffect(() => { window.clearTimeout(saveTimer.current); saveTimer.current = window.setTimeout(() => void persist(), 800); }, [s.version, s.pages, persist]);
  useEffect(() => {
    const onClose = () => void persist();
    window.addEventListener('beforeunload', onClose); return () => window.removeEventListener('beforeunload', onClose);
  }, [persist]);

  // visibility virtualization
  useEffect(() => {
    const root = scrollRef.current; if (!root) return;
    const obs = new IntersectionObserver((entries) => {
      setVisible((prev) => { const n = new Set(prev); entries.forEach((e) => { const id = (e.target as HTMLElement).dataset.pageid; if (!id) return; if (e.isIntersecting) n.add(id); else n.delete(id); }); return n; });
    }, { root, rootMargin: '600px 0px' });
    const els = root.querySelectorAll('[data-pageid]'); els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [s.pages.length]);

  // pinch zoom + ctrl wheel
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchDist = useRef(0);
  const onWheel = (e: React.WheelEvent) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); s.setZoom(s.zoom * (e.deltaY < 0 ? 1.1 : 0.9)); } };
  useEffect(() => {
    const el = scrollRef.current; if (!el) return;
    const handler = (e: WheelEvent) => { if (e.ctrlKey) e.preventDefault(); };
    el.addEventListener('wheel', handler, { passive: false }); return () => el.removeEventListener('wheel', handler);
  }, []);

  const addPage = (after = s.pages.length) => {
    const page = { id: newId(), notebookId: s.current!.id, width: A4.width, height: A4.height, background: { kind: 'template' as const, template }, strokes: [] };
    s.execute({ type: 'addPage', page, index: after });
  };
  const exportPdf = async () => {
    if (!s.current) return;
    const sources = new Map<string, ArrayBuffer>();
    for (const p of s.pages) if (p.background.kind === 'pdf') { const rec = await getPdf(p.background.pdfId); if (rec) sources.set(rec.id, rec.data); }
    const bytes = await exportNotebookToPdf(s.current, s.pages, sources);
    const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${s.current.title}.pdf`; a.click(); URL.revokeObjectURL(a.href);
  };

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) s.redo(); else s.undo(); }
      else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); s.redo(); }
      else if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); void persist(); }
      else if (mod && e.key.toLowerCase() === 'p') { e.preventDefault(); void exportPdf(); }
      else if (!mod && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        const k = e.key.toLowerCase();
        if (k === 'p') s.setTool('pen'); else if (k === 'h') s.setTool('highlighter'); else if (k === 'e') s.setTool('eraser'); else if (k === 'v') s.setTool('pan');
      }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.pages, s.current]);

  // space to pan (temporary)
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.code === 'Space' && !e.repeat) { const st = useStore.getState(); useStore.setState({ prevTool: st.tool, tool: 'pan' }); } };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') { const st = useStore.getState(); useStore.setState({ tool: st.prevTool }); } };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  const tools: { id: Tool; label: string; key: string }[] = [
    { id: 'pen', label: '✒ Pen', key: 'P' }, { id: 'highlighter', label: '🖍 Highlighter', key: 'H' }, { id: 'eraser', label: '⌫ Eraser', key: 'E' }, { id: 'pan', label: '✋ Pan', key: 'V / Space' }
  ];
  const activeToolKey = s.tool === 'pan' ? 'pen' : s.tool;
  return (
    <div className="flex h-screen flex-col bg-neutral-200 dark:bg-neutral-950">
      <header className="flex flex-wrap items-center gap-2 bg-white px-3 py-2 shadow dark:bg-neutral-900">
        <button className="min-h-[40px] min-w-[40px] rounded px-2 hover:bg-neutral-100 dark:hover:bg-neutral-800" onClick={async () => { await persist(); const { listNotebooks } = await import('../lib/db'); s.backToLibrary(await listNotebooks()); }}>← Library</button>
        <strong className="max-w-[180px] truncate">{s.current?.title}</strong>
        <div className="flex gap-1" role="toolbar" aria-label="Tools">
          {tools.map((t) => <button key={t.id} title={`${t.label} (${t.key})`} onClick={() => s.setTool(t.id)} className={`min-h-[40px] min-w-[40px] rounded px-3 ${s.tool === t.id ? 'bg-blue-600 text-white' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}>{t.label}</button>)}
        </div>
        <div className="flex items-center gap-1">
          {PALETTE.map((c) => <button key={c} aria-label={`color ${c}`} onClick={() => activeToolKey !== 'eraser' && s.setSetting(activeToolKey, { color: c })} className="h-8 w-8 rounded-full border" style={{ background: c }} />)}
          <input type="color" aria-label="custom color" value={s.settings[activeToolKey].color} onChange={(e) => activeToolKey !== 'eraser' && s.setSetting(activeToolKey, { color: e.target.value })} className="h-10 w-10 cursor-pointer" />
        </div>
        <label className="flex items-center gap-1 text-sm">Size
          <input type="range" min={1} max={40} value={s.settings[activeToolKey].size} onChange={(e) => s.setSetting(activeToolKey, { size: Number(e.target.value) })} />
          <span className="w-6 text-center">{s.settings[activeToolKey].size}</span>
        </label>
        <button className="min-h-[40px] min-w-[40px] rounded px-2 disabled:opacity-30" disabled={!s.stack.canUndo} onClick={s.undo} title="Undo Ctrl+Z">↩ Undo</button>
        <button className="min-h-[40px] min-w-[40px] rounded px-2 disabled:opacity-30" disabled={!s.stack.canRedo} onClick={s.redo} title="Redo Ctrl+Y">↪ Redo</button>
        <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={s.palmRejection} onChange={(e) => s.setPalm(e.target.checked)} /> Palm rejection</label>
        <div className="flex items-center gap-1">
          <button className="min-h-[40px] min-w-[40px] px-2" onClick={() => s.setZoom(s.zoom - 0.1)}>−</button>
          <span className="w-12 text-center text-sm">{Math.round(s.zoom * 100)}%</span>
          <button className="min-h-[40px] min-w-[40px] px-2" onClick={() => s.setZoom(s.zoom + 0.1)}>+</button>
        </div>
        <select value={template} onChange={(e) => setTemplate(e.target.value as TemplateKind)} className="min-h-[40px] rounded border bg-transparent px-1" aria-label="new page template">
          <option value="blank">Blank</option><option value="lined">Lined</option><option value="grid">Grid</option>
        </select>
        <button className="min-h-[40px] rounded bg-neutral-100 px-3 dark:bg-neutral-800" onClick={() => addPage()}>+ Page</button>
        <button className="min-h-[40px] rounded bg-blue-600 px-3 text-white" onClick={() => void exportPdf()}>Export PDF</button>
        <button className="min-h-[40px] rounded px-3 hover:bg-neutral-100 dark:hover:bg-neutral-800" onClick={() => void persist()}>Save</button>
      </header>
      <div className="flex min-h-0 flex-1">
        <aside className="w-[120px] shrink-0 overflow-y-auto bg-white p-2 dark:bg-neutral-900" aria-label="Pages">
          {s.pages.map((p, i) => (
            <div key={p.id} draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', String(i))}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { const from = Number(e.dataTransfer.getData('text/plain')); if (!Number.isNaN(from) && from !== i) s.execute({ type: 'reorderPages', from, to: i }); }}
              className="mb-2 cursor-pointer rounded border p-1 text-center text-xs hover:border-blue-500"
              onClick={() => document.querySelector(`[data-pageid="${p.id}"]`)?.scrollIntoView({ behavior: 'smooth' })}>
              <div className="flex h-16 items-center justify-center bg-neutral-100 text-neutral-500 dark:bg-neutral-800">{p.background.kind === 'pdf' ? 'PDF' : p.background.template} · {p.strokes.length} strokes</div>
              <div className="mt-1 flex items-center justify-between"><span>Page {i + 1}</span>
                <button aria-label={`delete page ${i + 1}`} className="min-h-[28px] min-w-[28px] text-red-500" onClick={(e) => { e.stopPropagation(); if (s.pages.length > 1) s.execute({ type: 'deletePage', page: p, index: i }); }}>✕</button></div>
            </div>
          ))}
          <button className="min-h-[40px] w-full rounded bg-neutral-100 dark:bg-neutral-800" onClick={() => addPage()}>+ Add page</button>
        </aside>
        <div ref={scrollRef} onWheel={onWheel} className="flex-1 overflow-auto"
          onPointerDown={(e) => { pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pointers.current.size === 2) { const [a, b] = [...pointers.current.values()]; pinchDist.current = Math.hypot(a.x - b.x, a.y - b.y); } }}
          onPointerMove={(e) => { if (!pointers.current.has(e.pointerId)) return; pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pointers.current.size === 2) { const [a, b] = [...pointers.current.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (pinchDist.current) s.setZoom(s.zoom * (d / pinchDist.current)); pinchDist.current = d; } else if (s.tool === 'pan' && e.buttons) { const el = scrollRef.current; if (el) { el.scrollLeft -= e.movementX; el.scrollTop -= e.movementY; } } }}
          onPointerUp={(e) => pointers.current.delete(e.pointerId)} onPointerCancel={(e) => pointers.current.delete(e.pointerId)}>
          <div ref={pagesRef}>
            {s.pages.length === 0 && <p className="p-8 text-center">No pages — add one.</p>}
            {useMemo(() => s.pages, [s.pages]).map((p, i) => (
              <div key={p.id} data-pageid={p.id}>
                <PageCanvas page={p} visible={visible.has(p.id) || i === 0} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
