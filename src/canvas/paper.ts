import type { Paper } from '@/data/types';
import type { Rect } from './camera';
import { PAPER_COLOURS } from './inkColours';

/**
 * Pages and paper (INK-8). Page sizes are CSS pixels at 96 dpi, so a page prints at its real
 * size. Pages stack vertically, centred on world x = 0, with a gap between them.
 */
export const PAGE_SIZES = {
  a4: { w: 794, h: 1123 },
  letter: { w: 816, h: 1056 },
} as const;

export const PAGE_GAP = 32;
/** An endless page is A4-wide and always this much taller than its lowest stroke. */
export const ENDLESS_ROOM = 900;
/** A sketch block in a typed note (NOTE-8) is one endless page that starts short. */
export const BLOCK_SIZE = { minHeight: 420, room: 240 };

export const DEFAULT_PAPER: Paper = { size: 'a4', template: 'blank', colour: 'white' };

export interface PageBox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  paper: Paper;
}

/**
 * Lays pages out top to bottom. `contentBottom` gives, per page id, the lowest point written
 * on it (page coordinates), which sizes endless pages.
 */
export function layoutPages(
  pages: Array<{ id: string; paper: Paper }>,
  contentBottom: (id: string) => number = () => 0,
  endless: { minHeight: number; room: number } = { minHeight: PAGE_SIZES.a4.h, room: ENDLESS_ROOM },
): PageBox[] {
  let y = 0;
  return pages.map((p) => {
    const fixed = p.paper.size === 'a4' || p.paper.size === 'letter' ? PAGE_SIZES[p.paper.size] : null;
    const w = fixed?.w ?? PAGE_SIZES.a4.w;
    const h = fixed?.h ?? Math.max(endless.minHeight, Math.ceil(contentBottom(p.id) + endless.room));
    const box = { id: p.id, x: -w / 2, y, w, h, paper: p.paper };
    y += h + PAGE_GAP;
    return box;
  });
}

export function boundsOfPages(boxes: PageBox[]): Rect {
  if (!boxes.length) return { minX: -397, minY: 0, maxX: 397, maxY: 1123 };
  return {
    minX: Math.min(...boxes.map((b) => b.x)),
    minY: boxes[0]!.y,
    maxX: Math.max(...boxes.map((b) => b.x + b.w)),
    maxY: boxes.at(-1)!.y + boxes.at(-1)!.h,
  };
}

/** The page under a world point; points in the gaps or outside go to the nearest page. */
export function pageAt(boxes: PageBox[], x: number, y: number): PageBox | null {
  let best: PageBox | null = null;
  let bestD = Infinity;
  for (const b of boxes) {
    const dx = Math.max(b.x - x, 0, x - (b.x + b.w));
    const dy = Math.max(b.y - y, 0, y - (b.y + b.h));
    const d = Math.hypot(dx, dy);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}

/** Spacing of template lines, grids and dots (world px). */
export const RULE = 32;
export const GRID = 24;
const TOP = 96;
const MARGIN = 72;

/**
 * Paints a page's paper and template into `ctx`, which is already transformed so that page
 * coordinates map to the screen. `px` is the size of one screen pixel in page units, so lines
 * stay hairline-thin at any zoom.
 */
export function drawPaper(ctx: CanvasRenderingContext2D, box: PageBox, px: number) {
  const c = PAPER_COLOURS[box.paper.colour];
  const { w, h } = box;
  ctx.fillStyle = c.paper;
  ctx.fillRect(0, 0, w, h);
  ctx.lineWidth = px;
  ctx.strokeStyle = c.rule;
  ctx.fillStyle = c.rule;
  const hLines = (from: number, to: number, x0 = 0, x1 = w) => {
    ctx.beginPath();
    for (let y = from; y <= to; y += RULE) {
      ctx.moveTo(x0, y + 0.5 * px);
      ctx.lineTo(x1, y + 0.5 * px);
    }
    ctx.stroke();
  };
  const line = (x0: number, y0: number, x1: number, y1: number, colour = c.rule) => {
    ctx.strokeStyle = colour;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.strokeStyle = c.rule;
  };

  switch (box.paper.template) {
    case 'lined':
      hLines(TOP, h - RULE);
      line(MARGIN, 0, MARGIN, h, c.margin);
      break;
    case 'grid': {
      ctx.beginPath();
      for (let x = GRID; x < w; x += GRID) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
      }
      for (let y = GRID; y < h; y += GRID) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();
      break;
    }
    case 'dot': {
      const r = Math.max(1.1, px);
      for (let y = GRID; y < h; y += GRID) {
        for (let x = GRID; x < w; x += GRID) ctx.fillRect(x - r / 2, y - r / 2, r, r);
      }
      break;
    }
    case 'cornell': {
      const summary = Math.round((h * 0.78) / RULE) * RULE;
      const cue = Math.round(w * 0.3);
      hLines(TOP, summary - RULE, cue, w);
      line(0, TOP, w, TOP, c.margin);
      line(cue, TOP, cue, summary, c.margin);
      line(0, summary, w, summary, c.margin);
      break;
    }
    case 'planner': {
      line(0, TOP, w, TOP, c.margin);
      const hourH = RULE * 2;
      const times = MARGIN;
      ctx.font = `${12}px system-ui, sans-serif`;
      ctx.textBaseline = 'top';
      let hour = 7;
      for (let y = TOP + RULE; y + hourH <= h - RULE && hour <= 21; y += hourH, hour++) {
        line(0, y, w, y);
        line(times, y + RULE, w, y + RULE, c.faint);
        ctx.fillStyle = c.label;
        ctx.fillText(`${String(hour).padStart(2, '0')}:00`, 12, y + 6);
      }
      line(times, TOP, times, h, c.margin);
      break;
    }
    case 'blank':
      break;
  }
}
