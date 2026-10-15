import type { InkPoint, Stroke } from './types';
export interface Bounds { minX: number; minY: number; maxX: number; maxY: number }
export function strokeBounds(s: Stroke, pad = 0): Bounds {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of s.points) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }
  if (!isFinite(minX)) { minX = minY = maxX = maxY = 0; }
  const r = s.size / 2 + pad;
  return { minX: minX - r, minY: minY - r, maxX: maxX + r, maxY: maxY + r };
}
export function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}
export function strokeHit(s: Stroke, p: InkPoint, radius: number): boolean {
  const b = strokeBounds(s, radius);
  if (p.x < b.minX || p.x > b.maxX || p.y < b.minY || p.y > b.maxY) return false;
  const thresh = radius + s.size / 2;
  if (s.points.length === 1) return Math.hypot(p.x - s.points[0].x, p.y - s.points[0].y) <= thresh;
  for (let i = 1; i < s.points.length; i++) {
    const a = s.points[i - 1], c = s.points[i];
    if (distToSegment(p.x, p.y, a.x, a.y, c.x, c.y) <= thresh) return true;
  }
  return false;
}
/** Detect pens that report a constant 0 or 0.5 pressure (no real pressure support). */
export function hasRealPressure(pressures: number[]): boolean {
  if (pressures.length < 3) return false;
  const uniq = new Set(pressures.map((v) => Math.round(v * 1000)));
  return uniq.size > 2;
}
export function normalizePressure(raw: number, pointerType: string, realPressure: boolean): number {
  if (pointerType === 'mouse') return 0.5;
  if (!realPressure) return 0.5;
  return Math.min(1, Math.max(0, raw));
}
