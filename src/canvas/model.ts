import RBush from 'rbush';
import { boundsOf, decodePoints, distanceToPolyline, encodePoints, type InkPoint } from './points';
import { PEN_STYLES, type PenTool } from './strokeStyle';
import type { Stroke } from '@/data/types';
import type { Rect } from './camera';

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

/** Strokes that appeared and disappeared in one user action. */
export interface StrokeChange {
  added: InkStroke[];
  removed: InkStroke[];
}

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

const invert = (c: StrokeChange): StrokeChange => ({ added: c.removed, removed: c.added });
const byId = (a: InkStroke, b: InkStroke) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export class InkModel {
  private pages = new Map<string, { list: InkStroke[]; tree: RBush<Box> }>();
  private boxes = new Map<string, Box>();
  private undoStack: StrokeChange[] = [];
  private redoStack: StrokeChange[] = [];

  constructor(strokes: InkStroke[] = []) {
    this.apply({ added: strokes, removed: [] });
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
    for (const s of change.added) this.addOne(s);
  }

  /** Applies a user action and records it for undo. Empty changes are ignored. */
  commit(change: StrokeChange): StrokeChange | null {
    if (!change.added.length && !change.removed.length) return null;
    this.apply(change);
    this.undoStack.push(change);
    this.redoStack = [];
    return change;
  }

  /** Records a change that was already applied (strokes erased live while dragging). */
  record(change: StrokeChange) {
    if (!change.added.length && !change.removed.length) return;
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

  /** Forgets a page's strokes without recording anything (the page was deleted). */
  dropPage(pageId: string): InkStroke[] {
    const list = [...this.strokes(pageId)];
    for (const s of list) this.removeOne(s.id);
    this.pages.delete(pageId);
    return list;
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
