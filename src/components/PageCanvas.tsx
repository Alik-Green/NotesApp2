import { useEffect, useRef, useState } from 'react';
import type { Page, Stroke, InkPoint } from '../lib/types';
import { drawStroke, drawTemplate, strokeOutline } from '../lib/render';
import { useStore } from '../store';
import { newId } from '../lib/id';
import { eraseAlongPath } from '../lib/eraser';
import { hasRealPressure, normalizePressure } from '../lib/geometry';
import { getPdf } from '../lib/db';
import { renderPdfPage } from '../lib/pdfService';

interface Props { page: Page; visible: boolean }
export default function PageCanvas({ page, visible }: Props) {
  const bgRef = useRef<HTMLCanvasElement>(null);
  const inkRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { zoom, tool, settings, execute, pushApplied, dark } = useStore();
  const drawing = useRef<null | { points: InkPoint[]; tool: 'pen' | 'highlighter' | 'eraser'; erased: Stroke[]; pointerId: number; pressures: number[]; restoreTool?: string }>(null);
  const lastPen = useRef(0);
  const raf = useRef(0);
  const [hover, setHover] = useState<{ x: number; y: number; size: number } | null>(null);
  const scale = zoom;
  const w = page.width, h = page.height;

  // background
  useEffect(() => {
    if (!visible) return;
    const canvas = bgRef.current; if (!canvas) return;
    let cancelled = false; let cancelFn: (() => void) | undefined;
    (async () => {
      const dpr = window.devicePixelRatio || 1;
      if (page.background.kind === 'template') {
        canvas.width = w * scale * dpr; canvas.height = h * scale * dpr;
        canvas.style.width = `${w * scale}px`; canvas.style.height = `${h * scale}px`;
        const ctx = canvas.getContext('2d', { desynchronized: true }); if (!ctx) return;
        ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
        drawTemplate(ctx, w, h, page.background.template, dark);
      } else {
        const rec = await getPdf(page.background.pdfId); if (!rec || cancelled) return;
        cancelFn = await renderPdfPage(canvas, page.background.pdfId, rec.data, page.background.pageIndex, scale * (w / page.background.width));
        // renderPdfPage sets CSS size in pdf points; normalize to page display size
        canvas.style.width = `${w * scale}px`; canvas.style.height = `${h * scale}px`;
      }
    })();
    return () => { cancelled = true; cancelFn?.(); };
  }, [visible, page.background, scale, w, h, dark]);

  // committed ink
  useEffect(() => {
    if (!visible) return;
    const canvas = inkRef.current; if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * scale * dpr; canvas.height = h * scale * dpr;
    canvas.style.width = `${w * scale}px`; canvas.style.height = `${h * scale}px`;
    const ctx = canvas.getContext('2d', { desynchronized: true }); if (!ctx) return;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    ctx.clearRect(0, 0, w, h);
    for (const s of page.strokes) drawStroke(ctx, s);
  }, [visible, page.strokes, scale, w, h]);

  // live canvas size
  useEffect(() => {
    const canvas = liveRef.current; if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * scale * dpr; canvas.height = h * scale * dpr;
    canvas.style.width = `${w * scale}px`; canvas.style.height = `${h * scale}px`;
  }, [scale, w, h]);

  const toLocal = (e: React.PointerEvent): InkPoint => {
    const rect = liveRef.current!.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale, pressure: e.pressure, tiltX: e.tiltX, tiltY: e.tiltY, t: e.timeStamp };
  };
  const drawLive = () => {
    const canvas = liveRef.current; const d = drawing.current; if (!canvas || !d) return;
    const ctx = canvas.getContext('2d', { desynchronized: true }); if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (d.tool === 'eraser') {
      ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 1.5 / scale;
      const last = d.points[d.points.length - 1];
      if (last) { ctx.beginPath(); ctx.arc(last.x, last.y, settings.eraser.size / 2, 0, Math.PI * 2); ctx.stroke(); }
      return;
    }
    const tmp: Stroke = { id: 'live', pageId: page.id, tool: d.tool, color: settings[d.tool].color, size: settings[d.tool].size, points: d.points, createdAt: Date.now() };
    // use outline directly for low latency
    const outline = strokeOutline(tmp);
    if (outline.length) { ctx.save(); if (d.tool === 'highlighter') { ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.35; } ctx.fillStyle = tmp.color; ctx.beginPath(); outline.forEach((p, i) => i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1])); ctx.closePath(); ctx.fill(); ctx.restore(); }
  };

  const onDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    if (e.pointerType === 'pen') lastPen.current = Date.now();
    const st = useStore.getState();
    // palm rejection: touch ignored for drawing if pen seen recently
    if (e.pointerType === 'touch' && st.palmRejection && Date.now() - lastPen.current < 3000) return;
    if (st.tool === 'pan') return; // pan handled by container scroll / drag in Editor via hand tool (native scroll)
    const isEraserEnd = e.pointerType === 'pen' && ((e.buttons & 32) !== 0 || e.button === 5);
    const barrel = e.pointerType === 'pen' && (e.buttons & 2) !== 0;
    let effective: 'pen' | 'highlighter' | 'eraser' = st.tool as 'pen' | 'highlighter' | 'eraser';
    if (isEraserEnd || (barrel && st.barrelAction === 'eraser')) effective = 'eraser';
    const p = toLocal(e);
    drawing.current = { points: [p], tool: effective, erased: [], pointerId: e.pointerId, pressures: [e.pressure] };
    // Chromium Ink API progressive enhancement
    const nav = navigator as Navigator & { ink?: { requestPresenter?: (opts?: unknown) => Promise<unknown> } };
    if (nav.ink?.requestPresenter) { void nav.ink.requestPresenter({ presentationArea: liveRef.current }).catch(() => undefined); }
  };
  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType === 'pen' && e.buttons === 0) { const p = toLocal(e); const t = useStore.getState().tool; const sz = t === 'eraser' ? settings.eraser.size : t === 'highlighter' ? settings.highlighter.size : settings.pen.size; setHover({ x: p.x * scale, y: p.y * scale, size: sz * scale }); return; }
    const d = drawing.current; if (!d || d.pointerId !== e.pointerId) return;
    const evts = typeof e.nativeEvent.getCoalescedEvents === 'function' ? e.nativeEvent.getCoalescedEvents() : [e.nativeEvent];
    for (const ev of evts) {
      const rect = liveRef.current!.getBoundingClientRect();
      const pt: InkPoint = { x: (ev.clientX - rect.left) / scale, y: (ev.clientY - rect.top) / scale, pressure: ev.pressure, tiltX: ev.tiltX, tiltY: ev.tiltY, t: ev.timeStamp };
      d.pressures.push(ev.pressure);
      const real = hasRealPressure(d.pressures);
      pt.pressure = normalizePressure(ev.pressure, ev.pointerType, real);
      d.points.push(pt);
      if (d.tool === 'eraser') {
        const hit = eraseAlongPath([pt], settings.eraser.size / 2, page.strokes.filter((s) => !d.erased.some((x) => x.id === s.id)));
        if (hit.length) { d.erased.push(...hit); const ids = new Set(hit.map((s) => s.id)); page.strokes = page.strokes.filter((s) => !ids.has(s.id)); useStore.getState().bump(); }
      }
    }
    cancelAnimationFrame(raf.current); raf.current = requestAnimationFrame(drawLive);
  };
  const onUp = (e: React.PointerEvent) => {
    const d = drawing.current; if (!d || d.pointerId !== e.pointerId) return;
    drawing.current = null;
    const ctx = liveRef.current?.getContext('2d'); ctx?.clearRect(0, 0, liveRef.current!.width, liveRef.current!.height);
    if (d.tool === 'eraser') {
      if (d.erased.length) {
        // strokes already removed optimistically; register as ONE undo step without re-applying
        page.strokes = [...page.strokes, ...d.erased]; // restore then execute removal via command
        execute({ type: 'removeStrokes', pageId: page.id, strokes: d.erased });
      }
      return;
    }
    if (d.points.length < 2) d.points.push({ ...d.points[0], x: d.points[0].x + 0.1 });
    const stroke: Stroke = { id: newId(), pageId: page.id, tool: d.tool, color: settings[d.tool].color, size: settings[d.tool].size, points: d.points, createdAt: Date.now() };
    execute({ type: 'addStroke', stroke });
    void pushApplied;
  };

  return (
    <div ref={wrapRef} className="relative mx-auto my-4 shadow-lg shrink-0" style={{ width: w * scale, height: h * scale }} data-testid={`page-${page.id}`}>
      <canvas ref={bgRef} className="absolute inset-0 rounded-sm bg-white" />
      <canvas ref={inkRef} className="absolute inset-0" />
      <canvas ref={liveRef} className="absolute inset-0" style={{ touchAction: 'none', cursor: tool === 'pan' ? 'grab' : 'none', userSelect: 'none' }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        onPointerLeave={() => setHover(null)} onContextMenu={(e) => e.preventDefault()} data-testid="ink-canvas" />
      {hover && tool !== 'pan' && <div className="pointer-events-none absolute rounded-full border border-gray-500/70" style={{ left: hover.x - hover.size / 2, top: hover.y - hover.size / 2, width: hover.size, height: hover.size }} />}
    </div>
  );
}
