/** A sampled pen point in world coordinates. */
export interface InkPoint {
  x: number;
  y: number;
  /** 0–1. Devices without pressure report a constant; see normalisePressure. */
  p: number;
  /** Milliseconds since the stroke started. */
  t: number;
}

/**
 * Compact stroke storage (ARCHITECTURE §8.3, validated in the ink spike):
 * x/y quantised to 1/16 px and stored as zig-zag varint deltas, pressure as one byte,
 * time as a varint delta in ms. Typical handwriting costs ~4–6 bytes per point.
 */
const Q = 16;

function writeVarint(out: number[], n: number) {
  let v = n >>> 0;
  while (v >= 0x80) {
    out.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  out.push(v);
}

const zigzag = (n: number) => (n << 1) ^ (n >> 31);
const unzigzag = (n: number) => (n >>> 1) ^ -(n & 1);

export function encodePoints(points: InkPoint[]): Uint8Array {
  const out: number[] = [];
  writeVarint(out, points.length);
  let px = 0;
  let py = 0;
  let pt = 0;
  for (const pt0 of points) {
    const x = Math.round(pt0.x * Q);
    const y = Math.round(pt0.y * Q);
    const t = Math.max(0, Math.round(pt0.t));
    writeVarint(out, zigzag(x - px));
    writeVarint(out, zigzag(y - py));
    out.push(Math.max(0, Math.min(255, Math.round(pt0.p * 255))));
    writeVarint(out, Math.max(0, t - pt));
    px = x;
    py = y;
    pt = Math.max(pt, t);
  }
  return Uint8Array.from(out);
}

export function decodePoints(bytes: Uint8Array): InkPoint[] {
  let i = 0;
  const read = () => {
    let shift = 0;
    let v = 0;
    for (;;) {
      const b = bytes[i++]!;
      v |= (b & 0x7f) << shift;
      if (b < 0x80) return v >>> 0;
      shift += 7;
    }
  };
  const n = read();
  const points: InkPoint[] = [];
  let x = 0;
  let y = 0;
  let t = 0;
  for (let k = 0; k < n; k++) {
    x += unzigzag(read());
    y += unzigzag(read());
    const p = bytes[i++]! / 255;
    t += read();
    points.push({ x: x / Q, y: y / Q, p, t });
  }
  return points;
}

/**
 * Pens report real pressure. Mice report 0.5 while pressed and touch usually reports 0 or
 * 0.5; for those, return null so the renderer simulates pressure from speed instead.
 * Some pens report 0 on the very first sample, so clamp to a small minimum.
 */
export function normalisePressure(pointerType: string, pressure: number): number | null {
  if (pointerType !== 'pen') return null;
  return Math.max(0.05, Math.min(1, pressure || 0.05));
}

export function boundsOf(points: InkPoint[], pad = 0): [number, number, number, number] {
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
  return [minX - pad, minY - pad, maxX + pad, maxY + pad];
}

/** Shortest distance from (px, py) to the polyline through `points`. */
export function distanceToPolyline(px: number, py: number, points: InkPoint[]): number {
  if (points.length === 1) return Math.hypot(px - points[0]!.x, py - points[0]!.y);
  let best = Infinity;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const u = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / len2));
    best = Math.min(best, Math.hypot(px - (a.x + u * dx), py - (a.y + u * dy)));
  }
  return best;
}
