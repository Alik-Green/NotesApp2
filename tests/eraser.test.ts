import { describe, it, expect } from 'vitest';
import { eraseAlongPath, StrokeIndex } from '../src/lib/eraser';
import { strokeHit, hasRealPressure } from '../src/lib/geometry';
import type { Stroke } from '../src/lib/types';
const s = (id: string, x: number): Stroke => ({ id, pageId: 'p', tool: 'pen', color: '#000', size: 4, points: [{ x, y: 10, pressure: .5 }, { x: x + 20, y: 10, pressure: .5 }], createdAt: 1 });
describe('eraser hit-testing', () => {
  it('hits nearby stroke, misses far', () => {
    expect(strokeHit(s('a', 0), { x: 10, y: 12, pressure: .5 }, 5)).toBe(true);
    expect(strokeHit(s('a', 0), { x: 10, y: 100, pressure: .5 }, 5)).toBe(false);
  });
  it('rbush index finds candidates along path', () => {
    const strokes = [s('a', 0), s('b', 200)];
    expect(eraseAlongPath([{ x: 10, y: 10, pressure: .5 }], 6, strokes).map((x) => x.id)).toEqual(['a']);
    expect(new StrokeIndex(strokes).eraseAt({ x: 210, y: 10, pressure: .5 }, 6, strokes).map((x) => x.id)).toEqual(['b']);
  });
  it('pressure support detection', () => { expect(hasRealPressure([.5, .5, .5])).toBe(false); expect(hasRealPressure([.1, .4, .9])).toBe(true); });
});
