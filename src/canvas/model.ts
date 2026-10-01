import RBush from 'rbush';
import { boundsOf, decodePoints, distanceToPolyline, encodePoints, type InkPoint } from './points';
import { PEN_STYLES, type PenTool } from './strokeStyle';
import type { InkElement, Stroke } from '@/data/types';
import type { Rect } from './camera';
import { applyMatrix, matrixScale, pointInPolygon, rectOfPoints, resample, type Matrix } from './geometry';

/**
 * The in-memory ink model (ARCHITECTURE §8.3): strokes per page in page coordinates, an
 * rbush index per page for hit-testing and culling, and a per-document undo stack of
 * change sets. Framework- and DOM-free, so it's unit tested directly.
 */

export interface InkStroke {
  id: string;
  pageId: string;
  tool: PenTool;
  /** A palette key ("blue") or "#rrggbb"; see inkColours.ts. */
  colour: string;
  /** Size multiplier on the pen's base width. */
  size: number;
  /** false when the device gave no pressure: the renderer simulates it from speed. */
  pressure: boolean;
  points: InkPoint[];
  bbox: [number, number, number, number];
  createdAt: string;
}

/** Strokes (and text boxes or images) that appeared and disappeared in one user action. */
export interface StrokeChange {
  added: InkStroke[];
  removed: InkStroke[];
  addedEls?: InkElement[];
  removedEls?: InkElement[];
}

const isEmpty = (c: StrokeChange) => !c.added.length && !c.removed.length && !c.addedEls?.length && !c.removedEls?.length;

interface Box extends Rect {
  stroke: InkStroke;
}

export const strokeRadius = (tool: PenTool, size: number) => ((PEN_STYLES[tool].options.size ?? 4) * size) / 2 + 1;

export function makeStroke(fields: Omit<InkStroke, 'bbox'>): InkStroke {
  return { ...fields, bbox: boundsOf(fields.points, strokeRadius(fields.tool, fields.size)) };
}

export function toStored(s: InkStroke): Stroke {
  return {
    id: s.id,
    pageId: s.pageId,
    tool: s.tool,
    colour: s.colour,
    size: s.size,
    opacity: PEN_STYLES[s.tool].opacity,
    pressure: s.pressure,
    points: encodePoints(s.points),
    bbox: s.bbox,
    createdAt: s.createdAt,
  };
}

export function fromStored(s: Stroke): InkStroke {
  const points = decodePoints(s.points);
  return {
    id: s.id,
    pageId: s.pageId,
    tool: s.tool,
    colour: s.colour,
    size: s.size,
    pressure: s.pressure ?? true,
    points,
    bbox: boundsOf(points, strokeRadius(s.tool, s.size)),
    createdAt: s.createdAt,
  };
}

/**
 * Precise erase (INK-3): cuts out the part of a stroke within `r` of (x, y). Returns the
 * pieces left (possibly none), or null when the eraser didn't touch it. Pieces get ids that
 * sort right after the original's, so they keep its place in the stack.
 */
export function splitStroke(s: InkStroke, x: number, y: number, r: number): InkStroke[] | null {
  const reach = r + strokeRadius(s.tool, s.size);
  const pts = resample(s.points, Math.max(0.5, r / 2));
  const keep = pts.map((p) => Math.hypot(p.x - x, p.y - y) > reach);
  if (keep.every(Boolean)) return null;
  const pieces: InkPoint[][] = [];
  let run: InkPoint[] = [];
  pts.forEach((p, i) => {
    if (keep[i]) run.push(p);
    else if (run.length) {
      pieces.push(run);
      run = [];
    }
  });
  if (run.length) pieces.push(run);
  return pieces
    .filter((piece) => piece.length > 1)
    .map((points, i) => makeStroke({ ...s, id: `${s.id}~${i}`, points: points.map((p) => ({ ...p, t: p.t - points[0]!.t })) }));
}

/** A stroke moved, scaled or rotated (same id, so it keeps its place in the stack). */
export function transformStroke(s: InkStroke, m: Matrix, pageId = s.pageId): InkStroke {
  const k = matrixScale(m);
  return makeStroke({
    ...s,
    pageId,
    size: Math.min(12, Math.max(0.2, s.size * k)),
    points: s.points.map((p) => ({ ...applyMatrix(m, p.x, p.y), p: p.p, t: p.t })),
  });
}

/** The area covered by some strokes. */
export function boundsOfStrokes(strokes: readonly InkStroke[]): Rect | null {
  if (!strokes.length) return null;
  return {
    minX: Math.min(...strokes.map((s) => s.bbox[0])),
    minY: Math.min(...strokes.map((s) => s.bbox[1])),
    maxX: Math.max(...strokes.map((s) => s.bbox[2])),
    maxY: Math.max(...strokes.map((s) => s.bbox[3])),
  };
}

const invert = (c: StrokeChange): StrokeChange => ({ added: c.removed, removed: c.added, addedEls: c.removedEls, removedEls: c.addedEls });
const byId = (a: InkStroke, b: InkStroke) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export class InkModel {
  private pages = new Map<string, { list: InkStroke[]; tree: RBush<Box> }>();
  private boxes = new Map<string, Box>();
  private els = new Map<string, InkElement>();
  private undoStack: StrokeChange[] = [];
  private redoStack: StrokeChange[] = [];

  constructor(strokes: InkStroke[] = [], elements: InkElement[] = []) {
    this.apply({ added: strokes, removed: [], addedEls: elements });
  }

  /** Text boxes and images on a page, oldest first. */
  elements(pageId: string): InkElement[] {
    return [...this.els.values()].filter((e) => e.pageId === pageId).sort((a, b) => (a.id < b.id ? -1 : 1));
  }

  element(id: string) {
    return this.els.get(id);
  }

  get count() {
    return this.boxes.size;
  }
  get canUndo() {
    return this.undoStack.length > 0;
  }
  get canRedo() {
    return this.redoStack.length > 0;
  }

  get(id: string) {
    return this.boxes.get(id)?.stroke;
  }

  /** A page's strokes, oldest first (ids are time-ordered UUIDv7s, so this is z-order). */
  strokes(pageId: string): readonly InkStroke[] {
    return this.pages.get(pageId)?.list ?? [];
  }

  /** Strokes whose bounds touch `rect`, in z-order. */
  query(pageId: string, rect: Rect): InkStroke[] {
    const page = this.pages.get(pageId);
    if (!page) return [];
    return page.tree
      .search(rect)
      .map((b) => b.stroke)
      .sort(byId);
  }

  /** Lasso (INK-6): strokes with at least half their points inside the polygon. */
  inPolygon(pageId: string, poly: ReadonlyArray<{ x: number; y: number }>): InkStroke[] {
    if (poly.length < 3) return [];
    return this.query(pageId, rectOfPoints(poly)).filter((s) => {
      const inside = s.points.filter((p) => pointInPolygon(p.x, p.y, poly)).length;
      return inside >= s.points.length / 2;
    });
  }

  /** Strokes within `radius` of a point (the stroke eraser). */
  hit(pageId: string, x: number, y: number, radius: number): InkStroke[] {
    return this.query(pageId, { minX: x - radius, minY: y - radius, maxX: x + radius, maxY: y + radius }).filter(
      (s) => distanceToPolyline(x, y, s.points) <= radius + strokeRadius(s.tool, s.size),
    );
  }

  /** The lowest point written on a page (sizes endless pages). */
  contentBottom(pageId: string): number {
    const page = this.pages.get(pageId);
    return page && page.list.length ? page.tree.toJSON().maxY : 0;
  }

  /** Applies a change without recording it (loading, or an undo/redo step). */
  apply(change: StrokeChange) {
    for (const s of change.removed) this.removeOne(s.id);
    for (const e of change.removedEls ?? []) this.els.delete(e.id);
    for (const s of change.added) this.addOne(s);
    for (const e of change.addedEls ?? []) this.els.set(e.id, e);
  }

  /** Applies a user action and records it for undo. Empty changes are ignored. */
  commit(change: StrokeChange): StrokeChange | null {
    if (isEmpty(change)) return null;
    this.apply(change);
    this.undoStack.push(change);
    this.redoStack = [];
    return change;
  }

  /** Records a change that was already applied (strokes erased live while dragging). */
  record(change: StrokeChange) {
    if (isEmpty(change)) return;
    this.undoStack.push(change);
    this.redoStack = [];
  }

  /** Undoes the last action; returns what changed, for saving and repainting. */
  undo(): StrokeChange | null {
    const c = this.undoStack.pop();
    if (!c) return null;
    const inv = invert(c);
    this.apply(inv);
    this.redoStack.push(c);
    return inv;
  }

  redo(): StrokeChange | null {
    const c = this.redoStack.pop();
    if (!c) return null;
    this.apply(c);
    this.undoStack.push(c);
    return c;
  }

  clearHistory() {
    this.undoStack = [];
    this.redoStack = [];
  }

  /**
   * Forgets a page's strokes (the page was deleted) and removes them from the history, so
   * undoing can't bring back ink onto a page that isn't there. Undoing the page deletion
   * itself is app-level undo, which restores the page and its strokes from storage.
   */
  dropPage(pageId: string): InkStroke[] {
    const list = [...this.strokes(pageId)];
    for (const s of list) this.removeOne(s.id);
    this.pages.delete(pageId);
    for (const e of this.elements(pageId)) this.els.delete(e.id);
    const keep = <T extends { pageId: string }>(list: T[] | undefined) => (list ?? []).filter((x) => x.pageId !== pageId);
    const prune = (stack: StrokeChange[]) =>
      stack
        .map((c) => ({ added: keep(c.added), removed: keep(c.removed), addedEls: keep(c.addedEls), removedEls: keep(c.removedEls) }))
        .filter((c) => !isEmpty(c));
    this.undoStack = prune(this.undoStack);
    this.redoStack = prune(this.redoStack);
    return list;
  }

  hasPage(pageId: string) {
    return this.pages.has(pageId);
  }

  private addOne(s: InkStroke) {
    if (this.boxes.has(s.id)) return;
    let page = this.pages.get(s.pageId);
    if (!page) this.pages.set(s.pageId, (page = { list: [], tree: new RBush<Box>() }));
    const [minX, minY, maxX, maxY] = s.bbox;
    const box: Box = { minX, minY, maxX, maxY, stroke: s };
    this.boxes.set(s.id, box);
    page.tree.insert(box);
    // Keep z-order: binary-insert by id (undo puts a stroke back where it was).
    let lo = 0;
    let hi = page.list.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (page.list[mid]!.id < s.id) lo = mid + 1;
      else hi = mid;
    }
    page.list.splice(lo, 0, s);
  }

  private removeOne(id: string) {
    const box = this.boxes.get(id);
    if (!box) return;
    this.boxes.delete(id);
    const page = this.pages.get(box.stroke.pageId);
    if (!page) return;
    page.tree.remove(box);
    const i = page.list.indexOf(box.stroke);
    if (i >= 0) page.list.splice(i, 1);
  }
}
