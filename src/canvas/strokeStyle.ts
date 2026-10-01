import { getStroke, type StrokeOptions } from 'perfect-freehand';
import type { InkPoint } from './points';

export type PenTool = 'ballpoint' | 'fountain' | 'marker' | 'highlighter';

export interface PenStyle {
  options: StrokeOptions;
  opacity: number;
}

/** perfect-freehand presets per pen. `size` is the base diameter in world px. */
export const PEN_STYLES: Record<PenTool, PenStyle> = {
  ballpoint: { opacity: 1, options: { size: 2.6, thinning: 0.35, smoothing: 0.5, streamline: 0.35 } },
  fountain: {
    opacity: 1,
    options: { size: 4, thinning: 0.7, smoothing: 0.55, streamline: 0.4, start: { taper: 6 }, end: { taper: 10 } },
  },
  marker: { opacity: 1, options: { size: 7, thinning: 0.12, smoothing: 0.6, streamline: 0.45 } },
  highlighter: {
    opacity: 0.35,
    options: { size: 20, thinning: 0, smoothing: 0.6, streamline: 0.5, start: { cap: false }, end: { cap: false } },
  },
};

export interface OutlineInput {
  tool: PenTool;
  scale: number; // size multiplier
  points: InkPoint[];
  /** false when the device gave no pressure, or pressure is switched off. */
  pressure: boolean;
  complete: boolean;
}

/**
 * Returns an SVG path for the filled stroke outline (or a dot for very short strokes).
 * `explicit` writes every curve as a full Q command (for PDF writers that mishandle T).
 */
export function strokePath({ tool, scale, points, pressure, complete }: OutlineInput, explicit = false): string {
  const style = PEN_STYLES[tool];
  const size = (style.options.size ?? 4) * scale;
  const input = points.map((p) => [p.x, p.y, pressure ? p.p : 0.5]);
  const outline = getStroke(input, {
    ...style.options,
    size,
    simulatePressure: !pressure && tool !== 'highlighter',
    last: complete,
  });
  if (outline.length < 4) {
    const p = points[0];
    if (!p) return '';
    const r = size / 2;
    return `M${p.x - r},${p.y} a${r},${r} 0 1,0 ${r * 2},0 a${r},${r} 0 1,0 ${-r * 2},0`;
  }
  return explicit ? svgPathExplicit(outline) : svgPath(outline);
}

const avg = (a: number, b: number) => (a + b) / 2;

/** Smooth closed path through outline points (quadratic curves between midpoints). */
export function svgPath(points: number[][]): string {
  const [a, b, c] = points as [number[], number[], number[]];
  let d = `M${a[0]!.toFixed(2)},${a[1]!.toFixed(2)} Q${b[0]!.toFixed(2)},${b[1]!.toFixed(2)} ${avg(b[0]!, c[0]!).toFixed(2)},${avg(b[1]!, c[1]!).toFixed(2)} T`;
  for (let i = 2; i < points.length - 1; i++) {
    const p = points[i]!;
    const q = points[i + 1]!;
    d += `${avg(p[0]!, q[0]!).toFixed(2)},${avg(p[1]!, q[1]!).toFixed(2)} `;
  }
  return d + 'Z';
}

/** The same curve as svgPath, with each smooth T segment written out as Q (control point reflected). */
export function svgPathExplicit(points: number[][]): string {
  const f = (v: number) => v.toFixed(2);
  const [a, b, c] = points as [number[], number[], number[]];
  let cx = b[0]!;
  let cy = b[1]!;
  let x = avg(b[0]!, c[0]!);
  let y = avg(b[1]!, c[1]!);
  let d = `M${f(a[0]!)},${f(a[1]!)} Q${f(cx)},${f(cy)} ${f(x)},${f(y)}`;
  for (let i = 2; i < points.length - 1; i++) {
    const p = points[i]!;
    const q = points[i + 1]!;
    cx = 2 * x - cx;
    cy = 2 * y - cy;
    x = avg(p[0]!, q[0]!);
    y = avg(p[1]!, q[1]!);
    d += ` Q${f(cx)},${f(cy)} ${f(x)},${f(y)}`;
  }
  return d + ' Z';
}
