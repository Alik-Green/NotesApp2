import type { InkPoint, Stroke } from './types';
const r2 = (n: number) => Math.round(n * 100) / 100;
export interface CompactStroke { id: string; pageId: string; tool: Stroke['tool']; color: string; size: number; createdAt: number; pts: number[] }
export function serializeStroke(s: Stroke): CompactStroke {
  const pts: number[] = [];
  for (const p of s.points) pts.push(r2(p.x), r2(p.y), r2(p.pressure));
  return { id: s.id, pageId: s.pageId, tool: s.tool, color: s.color, size: s.size, createdAt: s.createdAt, pts };
}
export function deserializeStroke(c: CompactStroke): Stroke {
  const points: InkPoint[] = [];
  for (let i = 0; i + 2 < c.pts.length; i += 3) points.push({ x: c.pts[i], y: c.pts[i + 1], pressure: c.pts[i + 2] });
  return { id: c.id, pageId: c.pageId, tool: c.tool, color: c.color, size: c.size, createdAt: c.createdAt, points };
}
export function strokesToJson(s: Stroke[]): string { return JSON.stringify(s.map(serializeStroke)); }
export function strokesFromJson(json: string): Stroke[] { try { return (JSON.parse(json) as CompactStroke[]).map(deserializeStroke); } catch { return []; } }
