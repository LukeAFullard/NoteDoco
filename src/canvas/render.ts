import { PEN_STYLES, strokePath } from './strokeStyle';
import { drawPaper, type PageBox } from './paper';
import { resolveInk } from './inkColours';
import type { InkStroke } from './model';
import type { Rect } from './camera';

/**
 * Drawing pages and ink onto any 2D context: the live canvas, page thumbnails and PNG
 * export all use these, so they look the same.
 */

const paths = new WeakMap<InkStroke, Path2D>();

/** The stroke's filled outline, cached per stroke object (strokes are immutable). */
export function pathOf(s: InkStroke): Path2D {
  let p = paths.get(s);
  if (!p) {
    p = new Path2D(strokePath({ tool: s.tool, scale: s.size, points: s.points, pressure: s.pressure, complete: true }));
    paths.set(s, p);
  }
  return p;
}

export function fillStroke(ctx: CanvasRenderingContext2D, s: InkStroke, paper: PageBox['paper']['colour'], path = pathOf(s)) {
  ctx.globalAlpha = PEN_STYLES[s.tool].opacity;
  ctx.fillStyle = resolveInk(s.colour, paper);
  ctx.fill(path);
  ctx.globalAlpha = 1;
}

/** Paints strokes, highlighter first so it never covers pen ink (INK-2). `ctx` is in page coordinates. */
export function paintInk(ctx: CanvasRenderingContext2D, box: PageBox, strokes: readonly InkStroke[], hidden?: ReadonlySet<string>) {
  for (const s of strokes) if (s.tool === 'highlighter' && !hidden?.has(s.id)) fillStroke(ctx, s, box.paper.colour);
  for (const s of strokes) if (s.tool !== 'highlighter' && !hidden?.has(s.id)) fillStroke(ctx, s, box.paper.colour);
}

/** Paper and ink of one page into `ctx` (page coordinates), clipped to the page. */
export function paintPage(ctx: CanvasRenderingContext2D, box: PageBox, strokes: readonly InkStroke[], px: number) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, box.w, box.h);
  ctx.clip();
  drawPaper(ctx, box, px);
  paintInk(ctx, box, strokes);
  ctx.restore();
}

/** A page as an image `width` CSS pixels wide (thumbnails, PNG export). */
export function renderPageCanvas(box: PageBox, strokes: readonly InkStroke[], width: number, dpr = 1, crop?: Rect): HTMLCanvasElement {
  const area = crop ?? { minX: 0, minY: 0, maxX: box.w, maxY: box.h };
  const k = width / (area.maxX - area.minX);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(width * dpr));
  c.height = Math.max(1, Math.round((area.maxY - area.minY) * k * dpr));
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  ctx.setTransform(k * dpr, 0, 0, k * dpr, -area.minX * k * dpr, -area.minY * k * dpr);
  paintPage(ctx, box, strokes, 1 / (k * dpr));
  return c;
}
