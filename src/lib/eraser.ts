import RBush from 'rbush';
import type { InkPoint, Stroke } from './types';
import { strokeBounds, strokeHit, type Bounds } from './geometry';
interface Entry extends Bounds { stroke: Stroke }
class Index extends RBush<Entry> {
  toBBox(e: Entry): Bounds { return e; }
  compareMinX(a: Entry, b: Entry): number { return a.minX - b.minX; }
  compareMinY(a: Entry, b: Entry): number { return a.minY - b.minY; }
}
export class StrokeIndex {
  private tree = new Index();
  constructor(strokes: Stroke[] = []) { this.rebuild(strokes); }
  rebuild(strokes: Stroke[]): void { this.tree.clear(); this.tree.load(strokes.map((s) => ({ ...strokeBounds(s), stroke: s }))); }
  insert(s: Stroke): void { this.tree.insert({ ...strokeBounds(s), stroke: s }); }
  eraseAt(p: InkPoint, radius: number, strokes: Stroke[]): Stroke[] {
    const candidates = this.tree.search({ minX: p.x - radius, minY: p.y - radius, maxX: p.x + radius, maxY: p.y + radius }).map((e) => e.stroke);
    const pool = candidates.length ? candidates : strokes;
    return pool.filter((s) => strokeHit(s, p, radius));
  }
}
export function eraseAlongPath(points: InkPoint[], radius: number, strokes: Stroke[]): Stroke[] {
  const idx = new StrokeIndex(strokes);
  const hit = new Map<string, Stroke>();
  for (const p of points) for (const s of idx.eraseAt(p, radius, strokes)) hit.set(s.id, s);
  return [...hit.values()];
}
