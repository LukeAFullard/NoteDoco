import type { InkPoint } from './points';
import type { Rect } from './camera';

/** A 2D affine matrix [a, b, c, d, e, f]: x' = a·x + c·y + e, y' = b·x + d·y + f (canvas order). */
export type Matrix = [number, number, number, number, number, number];

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** m1 then m2. */
export function multiply(m2: Matrix, m1: Matrix): Matrix {
  const [a1, b1, c1, d1, e1, f1] = m1;
  const [a2, b2, c2, d2, e2, f2] = m2;
  return [a2 * a1 + c2 * b1, b2 * a1 + d2 * b1, a2 * c1 + c2 * d1, b2 * c1 + d2 * d1, a2 * e1 + c2 * f1 + e2, b2 * e1 + d2 * f1 + f2];
}

export const translate = (dx: number, dy: number): Matrix => [1, 0, 0, 1, dx, dy];

export function scaleAbout(s: number, cx: number, cy: number): Matrix {
  return [s, 0, 0, s, cx - s * cx, cy - s * cy];
}

export function rotateAbout(rad: number, cx: number, cy: number): Matrix {
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [cos, sin, -sin, cos, cx - cos * cx + sin * cy, cy - sin * cx - cos * cy];
}

export function applyMatrix(m: Matrix, x: number, y: number) {
  return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] };
}

/** How much a matrix scales lengths (uniform scale and rotation only). */
export const matrixScale = (m: Matrix) => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));

/** Even–odd point-in-polygon test. */
export function pointInPolygon(x: number, y: number, poly: ReadonlyArray<{ x: number; y: number }>): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function rectOfPoints(points: ReadonlyArray<{ x: number; y: number }>): Rect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

export function unionRects(rects: Rect[]): Rect | null {
  if (!rects.length) return null;
  return {
    minX: Math.min(...rects.map((r) => r.minX)),
    minY: Math.min(...rects.map((r) => r.minY)),
    maxX: Math.max(...rects.map((r) => r.maxX)),
    maxY: Math.max(...rects.map((r) => r.maxY)),
  };
}

/** Adds interpolated points so no two neighbours are further apart than `step`. */
export function resample(points: InkPoint[], step: number): InkPoint[] {
  if (points.length < 2) return points;
  const out: InkPoint[] = [points[0]!];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step);
    for (let k = 1; k < n; k++) {
      const t = k / n;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, p: a.p + (b.p - a.p) * t, t: a.t + (b.t - a.t) * t });
    }
    out.push(b);
  }
  return out;
}

/** Points along a segment, `step` apart (so a fast eraser doesn't skip over strokes). */
export function along(ax: number, ay: number, bx: number, by: number, step: number): Array<{ x: number; y: number }> {
  const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
  return Array.from({ length: n }, (_, k) => ({ x: ax + ((bx - ax) * (k + 1)) / n, y: ay + ((by - ay) * (k + 1)) / n }));
}
