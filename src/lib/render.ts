import { getStroke } from 'perfect-freehand';
import type { Stroke } from './types';
export function strokeOutline(s: Pick<Stroke, 'points' | 'size' | 'tool'>): number[][] {
  return getStroke(s.points.map((p) => [p.x, p.y, p.pressure] as [number, number, number]), {
    size: s.size, thinning: s.tool === 'pen' ? 0.6 : 0, smoothing: 0.5, streamline: 0.5, simulatePressure: false, last: true
  }) as number[][];
}
export function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke): void {
  const outline = strokeOutline(s);
  if (!outline.length) return;
  ctx.save();
  if (s.tool === 'highlighter') { ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.35; }
  ctx.fillStyle = s.color;
  ctx.beginPath();
  outline.forEach((p, i) => { if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]); });
  ctx.closePath(); ctx.fill(); ctx.restore();
}
export function drawTemplate(ctx: CanvasRenderingContext2D, w: number, h: number, kind: string, dark: boolean): void {
  ctx.fillStyle = dark ? '#1f2937' : '#ffffff'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = dark ? '#374151' : '#dbeafe'; ctx.lineWidth = 1;
  if (kind === 'lined') { ctx.beginPath(); for (let y = 48; y < h; y += 36) { ctx.moveTo(0, y); ctx.lineTo(w, y); } ctx.stroke(); }
  if (kind === 'grid') { ctx.beginPath(); for (let x = 0; x < w; x += 28) { ctx.moveTo(x, 0); ctx.lineTo(x, h); } for (let y = 0; y < h; y += 28) { ctx.moveTo(0, y); ctx.lineTo(w, y); } ctx.stroke(); }
}
