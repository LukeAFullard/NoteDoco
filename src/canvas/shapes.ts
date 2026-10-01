import type { InkPoint } from './points';
import { resample } from './geometry';

/**
 * Shape snapping (INK-11, ARCHITECTURE §8.4): hold the pen still at the end of a stroke and a
 * rough line, arrow, triangle, rectangle or ellipse becomes a clean one. Pure, so it's
 * tested with drawn-by-hand point lists.
 */

export type ShapeKind = 'line' | 'arrow' | 'triangle' | 'rectangle' | 'ellipse';

export interface Shape {
  kind: ShapeKind;
  /** The clean outline as one or more polylines (an arrow's head is drawn in the same stroke). */
  points: Array<{ x: number; y: number }>;
}

type Pt = { x: number; y: number };

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

function pathLength(pts: Pt[]) {
  let n = 0;
  for (let i = 1; i < pts.length; i++) n += dist(pts[i - 1]!, pts[i]!);
  return n;
}

function segDistance(p: Pt, a: Pt, b: Pt) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Ramer–Douglas–Peucker simplification. */
export function simplify(pts: Pt[], epsilon: number): Pt[] {
  if (pts.length < 3) return pts;
  let max = 0;
  let index = 0;
  const first = pts[0]!;
  const last = pts.at(-1)!;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = segDistance(pts[i]!, first, last);
    if (d > max) {
      max = d;
      index = i;
    }
  }
  if (max <= epsilon) return [first, last];
  return [...simplify(pts.slice(0, index + 1), epsilon).slice(0, -1), ...simplify(pts.slice(index), epsilon)];
}

/** Turning angle at b (0 = straight on, π = straight back). */
function turn(a: Pt, b: Pt, c: Pt) {
  const a1 = Math.atan2(b.y - a.y, b.x - a.x);
  const a2 = Math.atan2(c.y - b.y, c.x - b.x);
  let d = Math.abs(a2 - a1);
  if (d > Math.PI) d = 2 * Math.PI - d;
  return d;
}

/** Corners of a closed path: simplified vertices where the path really turns. */
function corners(pts: Pt[], epsilon: number): Pt[] {
  const s = simplify(pts, epsilon);
  if (dist(s[0]!, s.at(-1)!) < epsilon * 2) s.pop();
  let out = s;
  for (let pass = 0; pass < 3; pass++) {
    const n = out.length;
    if (n < 3) return out;
    out = out.filter((p, i) => turn(out[(i - 1 + n) % n]!, p, out[(i + 1) % n]!) > (35 * Math.PI) / 180);
  }
  return out;
}

const snapAngle = (a: number) => {
  const step = Math.PI / 2;
  const s = Math.round(a / step) * step;
  return Math.abs(a - s) < (10 * Math.PI) / 180 ? s : a;
};

function rotate(p: Pt, c: Pt, a: number): Pt {
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return { x: c.x + (p.x - c.x) * cos - (p.y - c.y) * sin, y: c.y + (p.x - c.x) * sin + (p.y - c.y) * cos };
}

function centroid(pts: Pt[]): Pt {
  return { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length };
}

/** A rectangle aligned with its longest side (snapped square to the page when nearly so). */
function fitRectangle(pts: Pt[], quad: Pt[]): Pt[] {
  let best = 0;
  let angle = 0;
  for (let i = 0; i < quad.length; i++) {
    const a = quad[i]!;
    const b = quad[(i + 1) % quad.length]!;
    if (dist(a, b) > best) {
      best = dist(a, b);
      angle = Math.atan2(b.y - a.y, b.x - a.x);
    }
  }
  angle = snapAngle(angle);
  const c = centroid(pts);
  const flat = pts.map((p) => rotate(p, c, -angle));
  // Trim the outer 5% so overshoots at the corners don't inflate the box.
  const xs = flat.map((p) => p.x).sort((a, b) => a - b);
  const ys = flat.map((p) => p.y).sort((a, b) => a - b);
  const q = (arr: number[], f: number) => arr[Math.min(arr.length - 1, Math.max(0, Math.round((arr.length - 1) * f)))]!;
  const [x0, x1, y0, y1] = [q(xs, 0.03), q(xs, 0.97), q(ys, 0.03), q(ys, 0.97)];
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
    { x: x0, y: y0 },
  ].map((p) => rotate(p, c, angle));
}

/** Least-effort ellipse fit: principal axes of the points; error is how far points stray from it. */
function fitEllipse(pts: Pt[]): { points: Pt[]; error: number } {
  const c = centroid(pts);
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const p of pts) {
    sxx += (p.x - c.x) ** 2;
    syy += (p.y - c.y) ** 2;
    sxy += (p.x - c.x) * (p.y - c.y);
  }
  let angle = snapAngle(0.5 * Math.atan2(2 * sxy, sxx - syy));
  const flat = pts.map((p) => rotate(p, c, -angle));
  let rx = Math.sqrt((2 * flat.reduce((s, p) => s + (p.x - c.x) ** 2, 0)) / pts.length);
  let ry = Math.sqrt((2 * flat.reduce((s, p) => s + (p.y - c.y) ** 2, 0)) / pts.length);
  if (Math.min(rx, ry) / Math.max(rx, ry) > 0.88) {
    rx = ry = (rx + ry) / 2; // a circle
    angle = 0;
  }
  const error = flat.reduce((s, p) => s + Math.abs(Math.hypot((p.x - c.x) / rx, (p.y - c.y) / ry) - 1), 0) / pts.length;
  const n = 72;
  const points = Array.from({ length: n + 1 }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    return rotate({ x: c.x + rx * Math.cos(t), y: c.y + ry * Math.sin(t) }, c, angle);
  });
  return { points, error };
}

/** A clean arrow: shaft plus a head in proportion to it. */
function arrow(from: Pt, tip: Pt): Pt[] {
  const a = Math.atan2(tip.y - from.y, tip.x - from.x);
  const head = Math.min(36, Math.max(12, dist(from, tip) * 0.25));
  const barb = (s: number) => ({ x: tip.x - head * Math.cos(a + s * 0.45), y: tip.y - head * Math.sin(a + s * 0.45) });
  return [from, tip, barb(1), tip, barb(-1)];
}

/** Recognises a stroke as a shape, or returns null to leave it as drawn. */
export function recognise(input: ReadonlyArray<Pt>): Shape | null {
  const pts = input.map((p) => ({ x: p.x, y: p.y }));
  if (pts.length < 4) return null;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const diag = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  if (diag < 12) return null;
  const length = pathLength(pts);
  const first = pts[0]!;
  const last = pts.at(-1)!;
  const closed = dist(first, last) < Math.max(16, length * 0.12);
  const eps = Math.max(3, diag * 0.06);

  if (!closed) {
    const chord = dist(first, last);
    const straight = Math.max(...pts.map((p) => segDistance(p, first, last)));
    if (straight / chord < 0.07) return { kind: 'line', points: [first, last] };
    // An arrow drawn in one go: shaft, then a head that doubles back near the tip.
    const s = simplify(pts, eps);
    if (s.length >= 4 && s.length <= 6) {
      const tip = s[1]!;
      const shaft = dist(s[0]!, tip);
      const near = s.slice(2).every((p) => dist(p, tip) < shaft * 0.45);
      if (shaft > length * 0.45 && near) return { kind: 'arrow', points: arrow(s[0]!, tip) };
    }
    return null;
  }

  const cs = corners(pts, eps);
  if (cs.length === 3) return { kind: 'triangle', points: [...cs, cs[0]!] };
  if (cs.length === 4) return { kind: 'rectangle', points: fitRectangle(pts, cs) };
  const e = fitEllipse(pts);
  if (e.error < 0.12) return { kind: 'ellipse', points: e.points };
  return null;
}

/** Turns a shape into ink points: evenly spaced, constant pressure, so the line is even. */
export function shapeToInk(shape: Shape, step = 3): InkPoint[] {
  const pts: InkPoint[] = shape.points.map((p, i) => ({ x: p.x, y: p.y, p: 0.5, t: i }));
  return resample(pts, step).map((p, i) => ({ ...p, t: i * 4 }));
}
