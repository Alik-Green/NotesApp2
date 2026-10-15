import { describe, it, expect } from 'vitest';
import { serializeStroke, deserializeStroke, strokesToJson, strokesFromJson } from '../src/lib/serialization';
import type { Stroke } from '../src/lib/types';
describe('stroke serialization round-trip', () => {
  it('round-trips', () => {
    const s: Stroke = { id: '1', pageId: 'p', tool: 'pen', color: '#123456', size: 4, createdAt: 42, points: [{ x: 1.234, y: 2.345, pressure: 0.456 }, { x: 3, y: 4, pressure: 1 }] };
    expect(deserializeStroke(serializeStroke(s))).toEqual({ ...s, points: [{ x: 1.23, y: 2.35, pressure: 0.46 }, { x: 3, y: 4, pressure: 1 }] });
    expect(strokesFromJson(strokesToJson([s]))).toHaveLength(1);
  });
});
