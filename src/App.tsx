import { useEffect, useRef, useState } from 'react';
import { useStore } from './store';
import Editor from './components/Editor';
import { A4, type TemplateKind } from './lib/types';
import { newId } from './lib/id';
import { listNotebooks, saveNotebook, deleteNotebook, loadPages, loadHistory, savePdf, db } from './lib/db';
import { CommandStack } from './lib/commands';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export default function App() {
  const s = useStore();
  const [template, setTemplate] = useState<TemplateKind>('blank');
  const fileRef = useRef<HTMLInputElement>(null);
  const refresh = async () => s.setNotebooks(await listNotebooks());
  useEffect(() => { void refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const create = async (tpl: TemplateKind = template) => {
    const id = newId(); const now = Date.now();
    const page = { id: newId(), notebookId: id, width: A4.width, height: A4.height, background: { kind: 'template' as const, template: tpl }, strokes: [] };
    const nb = { id, title: 'Untitled notebook', createdAt: now, updatedAt: now, pageIds: [page.id] };
    await saveNotebook(nb, [page]); await refresh();
  };
  const open = async (nb: (typeof s.notebooks)[number]) => {
    const pages = await loadPages(nb.id);
    const stack = CommandStack.deserialize(await loadHistory(nb.id));
    s.openNotebook(nb, pages, stack);
  };
  const importPdf = async (file: File) => {
    const data = await file.arrayBuffer();
    const pdfId = newId();
    const doc = await pdfjsLib.getDocument({ data: data.slice(0) }).promise;
    const pages = [];
    for (let i = 0; i < doc.numPages; i++) {
      const pg = await doc.getPage(i + 1); const vp = pg.getViewport({ scale: 1 });
      const scale = A4.width / vp.width;
      pages.push({ id: newId(), notebookId: '', width: Math.round(vp.width * scale), height: Math.round(vp.height * scale), background: { kind: 'pdf' as const, pdfId, pageIndex: i, width: vp.width, height: vp.height }, strokes: [] });
    }
    const id = newId(); const now = Date.now();
    pages.forEach((p) => { p.notebookId = id; });
    await savePdf({ id: pdfId, name: file.name, data, pageCount: doc.numPages });
    const nb = { id, title: file.name.replace(/\.pdf$/i, ''), createdAt: now, updatedAt: now, pageIds: pages.map((p) => p.id) };
    await saveNotebook(nb, pages); await refresh();
  };
  if (s.view === 'editor') return <Editor />;
  return (
    <div className="min-h-screen bg-neutral-100 p-6 dark:bg-neutral-950" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.name.toLowerCase().endsWith('.pdf')) void importPdf(f); }}>
      <header className="mx-auto mb-6 flex max-w-5xl flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold">📝 InkPad</h1>
        <span className="text-sm text-neutral-500">Stylus-first notes · Windows 11 / WebView2 & Electron</span>
        <div className="ml-auto flex gap-2">
          <select value={template} onChange={(e) => setTemplate(e.target.value as TemplateKind)} className="min-h-[40px] rounded border bg-white px-2 dark:bg-neutral-800" aria-label="template"><option value="blank">Blank</option><option value="lined">Lined</option><option value="grid">Grid</option></select>
          <button className="min-h-[40px] rounded bg-blue-600 px-4 text-white" onClick={() => void create()}>+ New notebook</button>
          <button className="min-h-[40px] rounded bg-white px-4 dark:bg-neutral-800" onClick={() => fileRef.current?.click()}>Import PDF</button>
          <input ref={fileRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importPdf(f); e.target.value = ''; }} />
        </div>
      </header>
      <main className="mx-auto grid max-w-5xl grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {s.notebooks.length === 0 && <p className="col-span-full rounded bg-white p-8 text-center text-neutral-500 dark:bg-neutral-900">No notebooks yet. Create one, or drag & drop a PDF here.</p>}
        {s.notebooks.map((nb) => (
          <article key={nb.id} className="rounded-xl bg-white p-3 shadow dark:bg-neutral-900">
            <button className="flex h-32 w-full items-center justify-center rounded bg-neutral-100 text-4xl dark:bg-neutral-800" onClick={() => void open(nb)} aria-label={`open ${nb.title}`}>📓</button>
            <input value={nb.title} onChange={(e) => { const t = e.target.value; s.setNotebooks(s.notebooks.map((n) => n.id === nb.id ? { ...n, title: t } : n)); }} onBlur={async (e) => { await db.notebooks.update(nb.id, { title: e.target.value, updatedAt: Date.now() }); }} className="mt-2 w-full bg-transparent font-medium" aria-label="notebook title" />
            <p className="text-xs text-neutral-500">{nb.pageIds.length} pages · {new Date(nb.updatedAt).toLocaleString()}</p>
            <div className="mt-2 flex gap-2">
              <button className="min-h-[40px] flex-1 rounded bg-blue-600 text-white" onClick={() => void open(nb)}>Open</button>
              <button className="min-h-[40px] rounded px-3 text-red-500" onClick={async () => { if (confirm(`Delete "${nb.title}"?`)) { await deleteNotebook(nb.id); await refresh(); } }}>Delete</button>
            </div>
          </article>
        ))}
      </main>
    </div>
  );
}
