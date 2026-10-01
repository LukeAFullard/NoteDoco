import { boundsOf, decodePoints, distanceToPolyline, encodePoints, normalisePressure, type InkPoint } from './points';

function handwriting(n: number): InkPoint[] {
  // A loopy, pen-like path sampled at ~240 Hz.
  return Array.from({ length: n }, (_, i) => ({
    x: 100 + i * 0.8 + Math.sin(i / 6) * 12,
    y: 200 + Math.cos(i / 5) * 9,
    p: 0.3 + 0.4 * Math.abs(Math.sin(i / 20)),
    t: Math.round(i * 4.17),
  }));
}

describe('point encoding', () => {
  it('round-trips within 1/32 px and 1/255 pressure', () => {
    const pts = handwriting(500);
    const back = decodePoints(encodePoints(pts));
    expect(back).toHaveLength(pts.length);
    back.forEach((b, i) => {
      expect(Math.abs(b.x - pts[i]!.x)).toBeLessThanOrEqual(1 / 32);
      expect(Math.abs(b.y - pts[i]!.y)).toBeLessThanOrEqual(1 / 32);
      expect(Math.abs(b.p - pts[i]!.p)).toBeLessThanOrEqual(1 / 255);
      expect(b.t).toBe(pts[i]!.t);
    });
  });

  it('handles negative coordinates and a single point', () => {
    const pts = [{ x: -5000.5, y: -0.25, p: 1, t: 0 }];
    expect(decodePoints(encodePoints(pts))).toEqual(pts);
  });

  it('stores handwriting in under 8 bytes per point', () => {
    const pts = handwriting(2000);
    expect(encodePoints(pts).length / pts.length).toBeLessThan(8);
  });
});

describe('pressure', () => {
  it('uses real pressure only for pens', () => {
    expect(normalisePressure('pen', 0.7)).toBe(0.7);
    expect(normalisePressure('pen', 0)).toBe(0.05);
    expect(normalisePressure('mouse', 0.5)).toBeNull();
    expect(normalisePressure('touch', 0)).toBeNull();
  });
});

describe('geometry', () => {
  it('computes padded bounds', () => {
    expect(boundsOf([{ x: 1, y: 2, p: 1, t: 0 }, { x: 5, y: -1, p: 1, t: 1 }], 1)).toEqual([0, -2, 6, 3]);
  });
  it('measures distance to a polyline', () => {
    const line = [{ x: 0, y: 0, p: 1, t: 0 }, { x: 10, y: 0, p: 1, t: 1 }];
    expect(distanceToPolyline(5, 3, line)).toBe(3);
    expect(distanceToPolyline(-4, 3, line)).toBe(5);
  });
});
