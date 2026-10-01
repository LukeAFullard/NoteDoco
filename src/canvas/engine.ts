import { InputRouter, DEFAULT_ROUTER_SETTINGS, type PointerSample, type RouterSettings } from './inputRouter';
import { normalisePressure, type InkPoint } from './points';
import { PEN_STYLES, strokePath, type PenTool } from './strokeStyle';
import { clampCamera, fitWidth, Inertia, visibleWorld, zoomAt, type Camera, type Rect, type Size } from './camera';
import { boundsOfPages, drawPaper, layoutPages, pageAt, type PageBox } from './paper';
import { resolveInk } from './inkColours';
import { boundsOfStrokes, InkModel, makeStroke, splitStroke, transformStroke, type InkStroke, type StrokeChange } from './model';
import { along, applyMatrix, IDENTITY, rotateAbout, scaleAbout, translate, type Matrix } from './geometry';
import { fillStroke, paintInk, pathOf } from './render';
import type { Paper } from '@/data/types';
import { newId, nowIso } from '@/lib/ids';

/**
 * The ink canvas core (P3.1–P3.4, ARCHITECTURE §8), grown from the ink-lab spike. It owns
 * input, the camera, tools and rendering; the model (model.ts) owns strokes and undo; the
 * caller owns saving (onChange) and the toolbar (onState).
 *
 * Layers, bottom to top: paper (pages and templates), dry ink (committed strokes, highlighter
 * under pen), wet ink (strokes being drawn, the lasso, and the selection being moved, repainted
 * every frame). Each is a viewport-sized canvas at device resolution, redrawn from vectors when
 * the camera moves, so strokes stay crisp at any zoom. Strokes are stored in page
 * coordinates; pages stack vertically.
 */

export type InkTool = PenTool | 'eraser' | 'lasso';
export type EraserMode = 'stroke' | 'precise';

export interface EngineSettings extends RouterSettings {
  /** Read every hardware sample (getCoalescedEvents). */
  coalesced: boolean;
  /** Draw a predicted tail while writing (getPredictedEvents). Never stored. */
  prediction: boolean;
  /** Ask for a low-latency (desynchronized) canvas for wet ink. */
  lowLatency: boolean;
  /** Use pen pressure where the device reports it. */
  pressure: boolean;
}

export const DEFAULT_ENGINE_SETTINGS: EngineSettings = {
  ...DEFAULT_ROUTER_SETTINGS,
  coalesced: true,
  prediction: true,
  lowLatency: true,
  pressure: true,
};

export interface EngineState {
  tool: InkTool;
  colour: string;
  size: number;
  eraser: EraserMode;
  eraseHighlighterOnly: boolean;
  zoom: number;
  canUndo: boolean;
  canRedo: boolean;
  strokeCount: number;
  /** The page in the middle of the view (0-based) and how many there are. */
  page: number;
  pageCount: number;
  /** Changes whenever pages are added, moved or re-papered (for page thumbnails). */
  layout: number;
  /** Lasso selection (INK-6). */
  selection: { count: number; colour: string | null; size: number | null } | null;
  canPaste: boolean;
}

export interface EngineOptions {
  pages: Array<{ id: string; paper: Paper }>;
  strokes: InkStroke[];
  settings?: EngineSettings;
  onState?: (s: EngineState) => void;
  /** A user action changed strokes: save it. Also called for undo and redo. */
  onChange?: (c: StrokeChange) => void;
  /** Someone wrote near the bottom of the last page (to add a page automatically). */
  onNearEnd?: () => void;
}

type Pt = { x: number; y: number };

type Active =
  | { kind: 'ink'; tool: PenTool; colour: string; size: number; page: PageBox; points: InkPoint[]; predicted: InkPoint[]; pressure: boolean; start: number }
  | { kind: 'erase'; page: PageBox; last: Pt | null; removed: Map<string, InkStroke>; added: Map<string, InkStroke> }
  | { kind: 'lasso'; page: PageBox; points: Pt[] }
  | { kind: 'transform'; mode: 'move' | 'scale' | 'rotate'; page: PageBox; from: Pt; matrix: Matrix };

interface NavGesture {
  start: number;
  maxPointers: number;
  moved: number;
  last: { cx: number; cy: number; d: number } | null;
}

/** Eraser reach in screen pixels. */
const ERASER_RADIUS = 10;
/** Selection handles: drawn radius and touch reach, in screen pixels. */
const HANDLE = 7;
const HANDLE_REACH = 22;
const ROTATE_OFFSET = 30;
/** Pasted and duplicated ink is offset this much (page px) so it's visibly a copy. */
const COPY_OFFSET = 24;

/** Copied ink, shared by every open ink note (so you can paste into another note). */
let clipboard: { strokes: InkStroke[]; bounds: Rect } | null = null;

export class InkEngine {
  readonly model: InkModel;
  readonly router: InputRouter;
  settings: EngineSettings;
  tool: InkTool = 'ballpoint';
  colour = 'black';
  size = 1;
  eraser: EraserMode = 'stroke';
  eraseHighlighterOnly = false;

  private host: HTMLElement;
  private paper: HTMLCanvasElement;
  private dry: HTMLCanvasElement;
  private wet!: HTMLCanvasElement;
  private paperCtx: CanvasRenderingContext2D;
  private dryCtx: CanvasRenderingContext2D;
  private wetCtx!: CanvasRenderingContext2D;
  private dpr = 1;
  private view: Size = { w: 1, h: 1 };
  private rect: DOMRect = new DOMRect();
  private cam: Camera = { x: 0, y: 0, zoom: 1 };
  private placed = false;
  private pages: Array<{ id: string; paper: Paper }>;
  private boxes: PageBox[] = [];
  private layoutVersion = 0;
  private active = new Map<number, Active>();
  private sel: { pageId: string; ids: string[] } | null = null;
  private nav = new Map<number, Pt>();
  private navGesture: NavGesture | null = null;
  private inertia = new Inertia();
  private coastFrom = 0;
  private spaceDown = false;
  private frame = 0;
  private dirtyStatic = true;
  private lastState = '';
  private colours = { accent: '#d9a54a', shadow: 'rgba(0,0,0,0.2)' };
  private resizeObserver: ResizeObserver;
  private listeners: Array<[EventTarget, string, EventListener, AddEventListenerOptions?]> = [];
  private opts: EngineOptions;

  constructor(host: HTMLElement, opts: EngineOptions) {
    this.host = host;
    this.opts = opts;
    this.settings = opts.settings ?? DEFAULT_ENGINE_SETTINGS;
    this.router = new InputRouter(this.settings);
    this.model = new InkModel(opts.strokes);
    this.pages = opts.pages;
    this.paper = this.makeCanvas('paper');
    this.paperCtx = this.paper.getContext('2d')!;
    this.dry = this.makeCanvas('dry');
    this.dryCtx = this.dry.getContext('2d')!;
    this.createWet();
    this.relayout();

    this.on(host, 'pointerdown', (e) => this.onDown(e as PointerEvent));
    this.on(host, 'pointermove', (e) => this.onMove(e as PointerEvent));
    this.on(host, 'pointerup', (e) => this.onUp(e as PointerEvent));
    this.on(host, 'pointercancel', (e) => this.onUp(e as PointerEvent, true));
    this.on(host, 'wheel', (e) => this.onWheel(e as WheelEvent), { passive: false });
    this.on(host, 'keydown', (e) => this.onKey(e as KeyboardEvent, true));
    this.on(host, 'keyup', (e) => this.onKey(e as KeyboardEvent, false));
    // iOS Safari: stop long presses from opening the text loupe and callouts.
    const block = (e: Event) => e.preventDefault();
    this.on(host, 'touchstart', block, { passive: false });
    this.on(host, 'touchmove', block, { passive: false });
    this.on(host, 'contextmenu', block);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();
  }

  destroy() {
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    for (const [t, type, fn, o] of this.listeners) t.removeEventListener(type, fn, o);
    this.paper.remove();
    this.dry.remove();
    this.wet.remove();
  }

  // ---- public API ----------------------------------------------------------

  get state(): EngineState {
    const selected = this.selected();
    const same = <T,>(f: (s: InkStroke) => T) => (selected.every((s) => f(s) === f(selected[0]!)) ? f(selected[0]!) : null);
    return {
      tool: this.tool,
      colour: this.colour,
      size: this.size,
      eraser: this.eraser,
      eraseHighlighterOnly: this.eraseHighlighterOnly,
      zoom: Math.round(this.cam.zoom * 100) / 100,
      canUndo: this.model.canUndo,
      canRedo: this.model.canRedo,
      strokeCount: this.model.count,
      page: Math.max(0, this.boxes.findIndex((b) => b.id === this.currentPage()?.id)),
      pageCount: this.boxes.length,
      layout: this.layoutVersion,
      selection: selected.length ? { count: selected.length, colour: same((s) => s.colour), size: same((s) => s.size) } : null,
      canPaste: !!clipboard,
    };
  }

  get camera(): Camera {
    return { ...this.cam };
  }

  get pageBoxes(): readonly PageBox[] {
    return this.boxes;
  }

  /** The page in the middle of the view. */
  currentPage(): PageBox | null {
    const v = visibleWorld(this.cam, this.view);
    return pageAt(this.boxes, (v.minX + v.maxX) / 2, (v.minY + v.maxY) / 2);
  }

  setTool(tool: InkTool) {
    this.tool = tool;
    if (tool !== 'lasso') this.clearSelection();
    this.emit();
  }

  setColour(colour: string) {
    this.colour = colour;
    this.emit();
  }

  setSize(size: number) {
    this.size = size;
    this.emit();
  }

  setEraser(mode: EraserMode, highlighterOnly = this.eraseHighlighterOnly) {
    this.eraser = mode;
    this.eraseHighlighterOnly = highlighterOnly;
    this.emit();
  }

  updateSettings(next: EngineSettings) {
    const recreate = next.lowLatency !== this.settings.lowLatency;
    this.settings = next;
    this.router.settings = next;
    if (recreate) {
      this.wet.remove();
      this.createWet();
      this.resize();
    }
  }

  /**
   * New page list (added, removed, reordered or new paper). `strokes` are those of pages the
   * engine hasn't seen (a restored or duplicated page). Keeps the view where it is.
   */
  setPages(pages: Array<{ id: string; paper: Paper }>, strokes: InkStroke[] = []) {
    const gone = this.pages.filter((p) => !pages.some((q) => q.id === p.id));
    for (const p of gone) this.model.dropPage(p.id);
    if (this.sel && gone.some((p) => p.id === this.sel!.pageId)) this.sel = null;
    this.model.apply({ added: strokes, removed: [] });
    this.pages = pages;
    this.relayout();
    this.setCamera(this.cam);
    this.emit();
  }

  undo(): boolean {
    const c = this.model.undo();
    if (!c) return false;
    this.changed(c);
    return true;
  }

  redo(): boolean {
    const c = this.model.redo();
    if (!c) return false;
    this.changed(c);
    return true;
  }

  /** Zooms around the centre of the view (toolbar buttons, keyboard). */
  zoomBy(factor: number) {
    this.inertia.reset();
    this.setCamera(zoomAt(this.cam, this.view.w / 2, this.view.h / 2, factor));
  }

  panBy(dx: number, dy: number) {
    this.inertia.reset();
    this.setCamera({ ...this.cam, x: this.cam.x + dx, y: this.cam.y + dy });
  }

  /** Fits the page width to the view, keeping the current page in view. */
  fit() {
    const page = this.currentPage();
    const fitted = fitWidth(boundsOfPages(this.boxes), this.view, { maxZoom: 1 });
    this.setCamera({ ...fitted, y: page ? 16 - page.y * fitted.zoom : fitted.y });
  }

  scrollToPage(index: number) {
    const page = this.boxes[index];
    if (!page) return;
    this.inertia.reset();
    this.setCamera({ ...this.cam, y: 16 - page.y * this.cam.zoom });
  }

  /** Repaints everything (e.g. the theme changed). */
  invalidate() {
    this.readColours();
    this.dirtyStatic = true;
    this.requestFrame();
  }

  // ---- selection (INK-6) ------------------------------------------------------

  selected(): InkStroke[] {
    if (!this.sel) return [];
    return this.sel.ids.map((id) => this.model.get(id)).filter((s): s is InkStroke => !!s);
  }

  /** Selects everything on the page in view (Ctrl/⌘-A). */
  selectAll() {
    const page = this.currentPage();
    if (!page) return;
    const ids = this.model.strokes(page.id).map((s) => s.id);
    this.select(page.id, ids);
  }

  clearSelection() {
    if (!this.sel) return;
    this.sel = null;
    this.requestFrame();
    this.emit();
  }

  deleteSelection() {
    const removed = this.selected();
    this.sel = null;
    this.commitChange({ added: [], removed });
  }

  /** Recolour or change the thickness of the selection. */
  restyleSelection(patch: { colour?: string; size?: number }) {
    const before = this.selected();
    this.commitChange({ removed: before, added: before.map((s) => makeStroke({ ...s, ...patch })) });
  }

  duplicateSelection() {
    const page = this.selPage();
    const strokes = this.selected();
    if (!page || !strokes.length) return;
    this.placeCopies(page, strokes, translate(COPY_OFFSET, COPY_OFFSET));
  }

  copySelection(): boolean {
    const strokes = this.selected();
    const bounds = boundsOfStrokes(strokes);
    if (!bounds) return false;
    clipboard = { strokes, bounds };
    this.emit();
    return true;
  }

  cutSelection() {
    if (this.copySelection()) this.deleteSelection();
  }

  /** Pastes copied ink onto the page in view: in the same place, or centred if that's off screen. */
  paste(): boolean {
    const page = this.currentPage();
    if (!clipboard || !page) return false;
    const v = visibleWorld(this.cam, this.view);
    const view = { minX: v.minX - page.x, minY: v.minY - page.y, maxX: v.maxX - page.x, maxY: v.maxY - page.y };
    const b = clipboard.bounds;
    const inView = b.minX >= view.minX && b.maxX <= view.maxX && b.minY >= view.minY && b.maxY <= view.maxY;
    const cx = (Math.max(0, view.minX) + Math.min(page.w, view.maxX)) / 2;
    const cy = (Math.max(0, view.minY) + Math.min(page.h, view.maxY)) / 2;
    const m = inView ? translate(COPY_OFFSET, COPY_OFFSET) : translate(cx - (b.minX + b.maxX) / 2, cy - (b.minY + b.maxY) / 2);
    this.placeCopies(page, clipboard.strokes, m);
    return true;
  }

  /** Moves the selection by (dx, dy) page pixels (arrow keys). */
  nudgeSelection(dx: number, dy: number) {
    const before = this.selected();
    if (!before.length) return;
    this.commitChange({ removed: before, added: before.map((s) => transformStroke(s, translate(dx, dy))) });
  }

  private select(pageId: string, ids: string[]) {
    this.sel = ids.length ? { pageId, ids } : null;
    this.requestFrame();
    this.emit();
  }

  private selPage() {
    return this.sel ? (this.boxes.find((b) => b.id === this.sel!.pageId) ?? null) : null;
  }

  private placeCopies(page: PageBox, strokes: InkStroke[], m: Matrix) {
    const now = nowIso();
    const copies = strokes.map((s) => transformStroke({ ...s, id: newId(), createdAt: now }, m, page.id));
    this.commitChange({ added: copies, removed: [] });
    this.select(page.id, copies.map((s) => s.id));
  }

  private commitChange(c: StrokeChange) {
    const done = this.model.commit(c);
    if (done) this.changed(done);
    else this.emit();
  }

  // ---- setup ---------------------------------------------------------------

  private makeCanvas(name: string) {
    const c = document.createElement('canvas');
    c.dataset.layer = name;
    c.setAttribute('aria-hidden', 'true');
    c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
    this.host.appendChild(c);
    return c;
  }

  private createWet() {
    this.wet = this.makeCanvas('wet');
    this.wetCtx = this.wet.getContext('2d', { desynchronized: this.settings.lowLatency } as CanvasRenderingContext2DSettings)!;
  }

  private readColours() {
    const css = getComputedStyle(this.host);
    this.colours = {
      accent: css.getPropertyValue('--nd-focus').trim() || this.colours.accent,
      shadow: css.getPropertyValue('--page-shadow').trim() || this.colours.shadow,
    };
  }

  private on(target: EventTarget, type: string, fn: EventListener, o?: AddEventListenerOptions) {
    target.addEventListener(type, fn, o);
    this.listeners.push([target, type, fn, o]);
  }

  private resize() {
    const r = (this.rect = this.host.getBoundingClientRect());
    this.view = { w: Math.max(1, r.width), h: Math.max(1, r.height) };
    this.dpr = window.devicePixelRatio || 1;
    for (const c of [this.paper, this.dry, this.wet]) {
      c.width = Math.max(1, Math.round(r.width * this.dpr));
      c.height = Math.max(1, Math.round(r.height * this.dpr));
    }
    if (!this.placed && r.width > 1) {
      this.placed = true;
      this.cam = fitWidth(boundsOfPages(this.boxes), this.view, { maxZoom: 1 });
    }
    this.readColours();
    this.setCamera(this.cam);
    this.paintStatic();
    this.paintWet();
    this.emit();
  }

  private relayout() {
    this.boxes = layoutPages(this.pages, (id) => this.model.contentBottom(id));
    this.layoutVersion++;
    this.dirtyStatic = true;
  }

  private setCamera(cam: Camera) {
    this.cam = clampCamera(cam, this.view, boundsOfPages(this.boxes));
    this.dirtyStatic = true;
    this.requestFrame();
  }

  private emit() {
    const s = this.state;
    const key = JSON.stringify(s);
    if (key === this.lastState) return;
    this.lastState = key;
    this.opts.onState?.(s);
  }

  /** After the model changed: relayout endless pages, repaint, save, update the toolbar. */
  private changed(c: StrokeChange) {
    if (this.boxes.some((b) => b.paper.size === 'endless' || b.paper.size === 'infinite')) this.relayout();
    if (this.sel) {
      const ids = this.sel.ids.filter((id) => this.model.get(id));
      this.sel = ids.length ? { ...this.sel, ids } : null;
    }
    this.dirtyStatic = true;
    this.requestFrame();
    this.opts.onChange?.(c);
    this.emit();
  }

  // ---- input -----------------------------------------------------------------

  private sample(e: PointerEvent): PointerSample {
    return { pointerId: e.pointerId, pointerType: e.pointerType, button: e.button, buttons: e.buttons, width: e.width, height: e.height, timeStamp: e.timeStamp };
  }

  private toWorld(e: PointerEvent) {
    const r = this.rect; // cached: reading layout for every pen sample would cost time
    return { x: (e.clientX - r.left - this.cam.x) / this.cam.zoom, y: (e.clientY - r.top - this.cam.y) / this.cam.zoom };
  }

  private toPagePt(e: PointerEvent, page: PageBox): Pt {
    const w = this.toWorld(e);
    return { x: w.x - page.x, y: w.y - page.y };
  }

  private toInkPoint(e: PointerEvent, page: PageBox, start: number): InkPoint {
    return { ...this.toPagePt(e, page), p: normalisePressure(e.pointerType, e.pressure) ?? 0.5, t: Math.max(0, e.timeStamp - start) };
  }

  private onKey(e: KeyboardEvent, down: boolean) {
    if (e.key === ' ') {
      this.spaceDown = down;
      if (e.target === this.host) e.preventDefault();
    }
  }

  private onDown(e: PointerEvent) {
    this.rect = this.host.getBoundingClientRect(); // the page may have scrolled since the last resize
    if (document.activeElement !== this.host) this.host.focus({ preventScroll: true });
    this.inertia.reset();
    const { role, retract } =
      this.spaceDown && e.pointerType !== 'touch' ? { role: { kind: 'navigate' as const }, retract: [] } : this.router.down(this.sample(e));
    for (const id of retract) this.discard(id);

    if (role.kind === 'ignore') return;
    try {
      this.host.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic events in tests can't be captured */
    }

    if (role.kind === 'navigate') {
      this.nav.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (!this.navGesture) this.navGesture = { start: e.timeStamp, maxPointers: 0, moved: 0, last: null };
      this.navGesture.maxPointers = Math.max(this.navGesture.maxPointers, this.nav.size);
      this.navGesture.last = this.navCentre();
      return;
    }

    // The selection's handles and body take the pointer first.
    if (role.tool === 'primary' && this.sel) {
      const page = this.selPage();
      const mode = page && this.selectionHit(this.toPagePt(e, page));
      if (page && mode) {
        this.active.set(e.pointerId, { kind: 'transform', mode, page, from: this.toPagePt(e, page), matrix: IDENTITY });
        this.dirtyStatic = true;
        this.requestFrame();
        return;
      }
      this.clearSelection();
    }

    const w = this.toWorld(e);
    const page = pageAt(this.boxes, w.x, w.y);
    if (!page) return;
    // Pen eraser end, or the barrel button (configurable in P3.10), erases.
    const tool: InkTool = role.tool === 'primary' ? this.tool : 'eraser';
    let a: Active;
    if (tool === 'eraser') a = { kind: 'erase', page, last: null, removed: new Map(), added: new Map() };
    else if (tool === 'lasso') a = { kind: 'lasso', page, points: [] };
    else
      a = {
        kind: 'ink',
        tool,
        colour: this.colour,
        size: this.size,
        page,
        points: [],
        predicted: [],
        pressure: this.settings.pressure && normalisePressure(e.pointerType, e.pressure) !== null,
        start: e.timeStamp,
      };
    this.active.set(e.pointerId, a);
    this.addSamples(a, [e]);
  }

  private onMove(e: PointerEvent) {
    if (e.pointerType === 'pen' && e.buttons === 0) {
      this.router.hover(this.sample(e));
      return;
    }
    const a = this.active.get(e.pointerId);
    if (a) {
      const coalesced = this.settings.coalesced && e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      this.addSamples(a, coalesced.length ? coalesced : [e]);
      if (a.kind === 'ink') {
        const predicted = this.settings.prediction && e.getPredictedEvents ? e.getPredictedEvents() : [];
        a.predicted = predicted.map((p) => this.toInkPoint(p, a.page, a.start));
      }
      return;
    }
    if (this.nav.has(e.pointerId)) {
      this.nav.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.updateNavigation(e.timeStamp);
    }
  }

  private onUp(e: PointerEvent, cancelled = false) {
    this.router.up(this.sample(e));
    const a = this.active.get(e.pointerId);
    if (a) {
      this.active.delete(e.pointerId);
      if (cancelled && a.kind === 'ink' && a.points.length < 2) this.requestFrame();
      else this.finish(a);
    }
    if (this.nav.delete(e.pointerId) && this.nav.size === 0 && this.navGesture) {
      const g = this.navGesture;
      this.navGesture = null;
      // Quick taps without movement: two fingers = undo, three = redo (INK-7).
      if (e.timeStamp - g.start < 300 && g.moved < 12) {
        if (g.maxPointers === 2) this.undo();
        if (g.maxPointers === 3) this.redo();
      } else if (this.inertia.release(e.timeStamp)) {
        this.coastFrom = performance.now();
        this.requestFrame();
      }
    }
  }

  private onWheel(e: WheelEvent) {
    e.preventDefault();
    this.inertia.reset();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.view.h : 1;
    const r = this.host.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey) {
      this.setCamera(zoomAt(this.cam, e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * unit * 0.01)));
    } else {
      const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
      const dy = e.shiftKey && !e.deltaX ? 0 : e.deltaY;
      this.setCamera({ ...this.cam, x: this.cam.x - dx * unit, y: this.cam.y - dy * unit });
    }
  }

  private navCentre() {
    const pts = [...this.nav.values()];
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    const d = pts.length > 1 ? Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y) : 0;
    return { cx, cy, d };
  }

  private updateNavigation(t: number) {
    const g = this.navGesture;
    if (!g) return;
    g.maxPointers = Math.max(g.maxPointers, this.nav.size);
    const now = this.navCentre();
    const last = g.last ?? now;
    let cam = { ...this.cam, x: this.cam.x + now.cx - last.cx, y: this.cam.y + now.cy - last.cy };
    if (this.nav.size > 1 && last.d > 0 && now.d > 0) cam = zoomAt(cam, now.cx - this.rect.left, now.cy - this.rect.top, now.d / last.d);
    g.moved += Math.hypot(now.cx - last.cx, now.cy - last.cy) + Math.abs(now.d - last.d);
    g.last = now;
    this.inertia.track(now.cx, now.cy, t);
    this.setCamera(cam);
  }

  /** Drops an in-progress action (a palm touched down just before the pen). */
  private discard(pointerId: number) {
    const a = this.active.get(pointerId);
    if (!a) return;
    this.active.delete(pointerId);
    if (a.kind === 'erase') this.model.apply({ added: [...a.removed.values()], removed: [...a.added.values()] });
    this.dirtyStatic = true;
    this.requestFrame();
  }

  // ---- tools -----------------------------------------------------------------

  private addSamples(a: Active, events: PointerEvent[]) {
    for (const ev of events) {
      if (a.kind === 'ink') {
        const p = this.toInkPoint(ev, a.page, a.start);
        const last = a.points.at(-1);
        if (!last || last.x !== p.x || last.y !== p.y) a.points.push(p);
      } else if (a.kind === 'erase') this.eraseAt(a, this.toPagePt(ev, a.page));
      else if (a.kind === 'lasso') a.points.push(this.toPagePt(ev, a.page));
      else a.matrix = this.transformFor(a, this.toPagePt(ev, a.page));
    }
    this.requestFrame();
  }

  private eraseAt(a: Extract<Active, { kind: 'erase' }>, p: Pt) {
    const r = ERASER_RADIUS / this.cam.zoom;
    const path = a.last ? along(a.last.x, a.last.y, p.x, p.y, r / 2) : [p];
    a.last = p;
    for (const q of path) {
      let hits = this.model.hit(a.page.id, q.x, q.y, r);
      if (this.eraseHighlighterOnly) hits = hits.filter((h) => h.tool === 'highlighter');
      for (const h of hits) {
        const pieces = this.eraser === 'precise' ? splitStroke(h, q.x, q.y, r) : [];
        if (!pieces) continue;
        this.model.apply({ added: pieces, removed: [h] });
        if (a.added.has(h.id)) a.added.delete(h.id);
        else a.removed.set(h.id, h);
        for (const piece of pieces) a.added.set(piece.id, piece);
        this.dirtyStatic = true;
      }
    }
  }

  /** Which part of the selection a point is on, if any. */
  private selectionHit(p: Pt): 'move' | 'scale' | 'rotate' | null {
    const b = this.selectionBounds();
    if (!b) return null;
    const reach = HANDLE_REACH / this.cam.zoom;
    if (Math.hypot(p.x - b.maxX, p.y - b.maxY) <= reach) return 'scale';
    if (Math.hypot(p.x - (b.minX + b.maxX) / 2, p.y - (b.minY - ROTATE_OFFSET / this.cam.zoom)) <= reach) return 'rotate';
    if (p.x >= b.minX && p.x <= b.maxX && p.y >= b.minY && p.y <= b.maxY) return 'move';
    return null;
  }

  private selectionBounds(): Rect | null {
    const b = boundsOfStrokes(this.selected());
    if (!b) return null;
    const pad = 6 / this.cam.zoom;
    return { minX: b.minX - pad, minY: b.minY - pad, maxX: b.maxX + pad, maxY: b.maxY + pad };
  }

  private transformFor(a: Extract<Active, { kind: 'transform' }>, p: Pt): Matrix {
    const b = this.selectionBounds();
    if (!b) return IDENTITY;
    if (a.mode === 'move') return translate(p.x - a.from.x, p.y - a.from.y);
    if (a.mode === 'scale') {
      // Uniform scale about the opposite corner, following the pointer's projection on the diagonal.
      const ox = b.minX;
      const oy = b.minY;
      const fx = a.from.x - ox;
      const fy = a.from.y - oy;
      const s = Math.max(0.1, ((p.x - ox) * fx + (p.y - oy) * fy) / Math.max(1e-6, fx * fx + fy * fy));
      return scaleAbout(s, ox, oy);
    }
    const cx = (b.minX + b.maxX) / 2;
    const cy = (b.minY + b.maxY) / 2;
    let angle = Math.atan2(p.y - cy, p.x - cx) - Math.atan2(a.from.y - cy, a.from.x - cx);
    // Snap to 45° steps when close, so things go back straight easily.
    const step = Math.PI / 4;
    const snapped = Math.round(angle / step) * step;
    if (Math.abs(angle - snapped) < (4 * Math.PI) / 180) angle = snapped;
    return rotateAbout(angle, cx, cy);
  }

  private finish(a: Active) {
    if (a.kind === 'erase') {
      const change = { added: [...a.added.values()], removed: [...a.removed.values()] };
      if (change.added.length || change.removed.length) {
        this.model.record(change);
        this.changed(change);
      }
      return;
    }
    if (a.kind === 'lasso') {
      const ids = this.model.inPolygon(a.page.id, a.points).map((s) => s.id);
      this.select(a.page.id, ids);
      return;
    }
    if (a.kind === 'transform') {
      const moved = Math.abs(a.matrix[4]) + Math.abs(a.matrix[5]) + Math.abs(a.matrix[0] - 1) + Math.abs(a.matrix[1]) > 0.01;
      const before = this.selected();
      this.dirtyStatic = true;
      if (moved && before.length) this.commitChange({ removed: before, added: before.map((s) => transformStroke(s, a.matrix)) });
      else this.requestFrame();
      return;
    }
    if (!a.points.length) return;
    const stroke = makeStroke({
      id: newId(),
      pageId: a.page.id,
      tool: a.tool,
      colour: a.colour,
      size: a.size,
      pressure: a.pressure,
      points: a.points,
      createdAt: nowIso(),
    });
    const change = this.model.commit({ added: [stroke], removed: [] })!;
    // Paint it straight into the dry layer in the same frame the wet copy goes, so it never
    // flickers. Highlighter sits under ink, so it needs a full repaint.
    const box = this.boxes.find((b) => b.id === a.page.id) ?? a.page;
    if (stroke.tool === 'highlighter') this.dirtyStatic = true;
    else {
      this.enterPage(this.dryCtx, box);
      fillStroke(this.dryCtx, stroke, box.paper.colour);
      this.dryCtx.restore();
    }
    this.requestFrame();
    this.opts.onChange?.(change);
    const endless = box.paper.size === 'endless' || box.paper.size === 'infinite';
    if (endless) this.relayout();
    else if (this.boxes.at(-1)?.id === box.id && stroke.bbox[3] > box.h * 0.8) this.opts.onNearEnd?.();
    this.emit();
  }

  // ---- rendering ---------------------------------------------------------------

  /** Sets ctx so page coordinates map to device pixels, clipped to the page. */
  private enterPage(ctx: CanvasRenderingContext2D, box: PageBox, clip = true) {
    const z = this.cam.zoom * this.dpr;
    ctx.save();
    ctx.setTransform(z, 0, 0, z, (this.cam.x + box.x * this.cam.zoom) * this.dpr, (this.cam.y + box.y * this.cam.zoom) * this.dpr);
    if (clip) {
      ctx.beginPath();
      ctx.rect(0, 0, box.w, box.h);
      ctx.clip();
    }
  }

  /** Page point to device pixels on the canvases. */
  private toDevice(box: PageBox, x: number, y: number): Pt {
    return { x: (this.cam.x + (box.x + x) * this.cam.zoom) * this.dpr, y: (this.cam.y + (box.y + y) * this.cam.zoom) * this.dpr };
  }

  private visiblePages() {
    const v = visibleWorld(this.cam, this.view);
    return this.boxes
      .filter((b) => b.x < v.maxX && b.x + b.w > v.minX && b.y < v.maxY && b.y + b.h > v.minY)
      .map((b) => ({ box: b, rect: { minX: v.minX - b.x, minY: v.minY - b.y, maxX: v.maxX - b.x, maxY: v.maxY - b.y } }));
  }

  private transforming() {
    for (const a of this.active.values()) if (a.kind === 'transform') return a;
    return null;
  }

  private paintStatic() {
    for (const ctx of [this.paperCtx, this.dryCtx]) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.paper.width, this.paper.height);
    }
    const px = 1 / this.cam.zoom;
    // While the selection is being moved it's drawn on the wet layer instead.
    const hidden = this.transforming() && this.sel ? new Set(this.sel.ids) : undefined;
    for (const { box, rect } of this.visiblePages()) {
      // Paper, with a soft edge so white pages stand out from a light background.
      const pc = this.paperCtx;
      this.enterPage(pc, box, false);
      pc.shadowColor = this.colours.shadow;
      pc.shadowBlur = 6 * this.dpr;
      pc.fillRect(0, 0, box.w, box.h);
      pc.shadowColor = 'transparent';
      pc.beginPath();
      pc.rect(0, 0, box.w, box.h);
      pc.clip();
      drawPaper(pc, box, px);
      pc.restore();

      this.enterPage(this.dryCtx, box);
      paintInk(this.dryCtx, box, this.model.query(box.id, rect), hidden);
      this.dryCtx.restore();
    }
    this.dirtyStatic = false;
  }

  private paintWet() {
    const ctx = this.wetCtx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.wet.width, this.wet.height);
    for (const a of this.active.values()) {
      const box = this.boxes.find((b) => b.id === a.page.id) ?? a.page;
      if (a.kind === 'ink' && a.points.length) {
        const pts = a.predicted.length ? [...a.points, ...a.predicted] : a.points;
        const path = new Path2D(strokePath({ tool: a.tool, scale: a.size, points: pts, pressure: a.pressure, complete: false }));
        this.enterPage(ctx, box);
        ctx.globalAlpha = PEN_STYLES[a.tool].opacity;
        ctx.fillStyle = resolveInk(a.colour, box.paper.colour);
        ctx.fill(path);
        ctx.restore();
      } else if (a.kind === 'lasso' && a.points.length > 1) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.strokeStyle = this.colours.accent;
        ctx.lineWidth = 1.5 * this.dpr;
        ctx.setLineDash([6 * this.dpr, 4 * this.dpr]);
        ctx.beginPath();
        a.points.forEach((p, i) => {
          const d = this.toDevice(box, p.x, p.y);
          if (i) ctx.lineTo(d.x, d.y);
          else ctx.moveTo(d.x, d.y);
        });
        ctx.stroke();
        ctx.restore();
      } else if (a.kind === 'transform') {
        this.enterPage(ctx, box);
        ctx.transform(...a.matrix);
        for (const s of this.selected()) fillStroke(ctx, s, box.paper.colour, pathOf(s));
        ctx.restore();
      }
    }
    this.paintSelectionChrome(ctx);
  }

  /** The selection's outline and handles, at a constant size on screen. */
  private paintSelectionChrome(ctx: CanvasRenderingContext2D) {
    const box = this.selPage();
    const b = this.selectionBounds();
    if (!box || !b) return;
    const m = this.transforming()?.matrix ?? IDENTITY;
    const corner = (x: number, y: number) => {
      const p = applyMatrix(m, x, y);
      return this.toDevice(box, p.x, p.y);
    };
    const corners = [corner(b.minX, b.minY), corner(b.maxX, b.minY), corner(b.maxX, b.maxY), corner(b.minX, b.maxY)];
    const topMid = corner((b.minX + b.maxX) / 2, b.minY);
    const rot = applyMatrix(m, (b.minX + b.maxX) / 2, b.minY - ROTATE_OFFSET / this.cam.zoom);
    const rotD = this.toDevice(box, rot.x, rot.y);
    const d = this.dpr;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.strokeStyle = this.colours.accent;
    ctx.lineWidth = 1.5 * d;
    ctx.setLineDash([6 * d, 4 * d]);
    ctx.beginPath();
    corners.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(topMid.x, topMid.y);
    ctx.lineTo(rotD.x, rotD.y);
    ctx.stroke();
    ctx.fillStyle = this.colours.accent;
    for (const p of [corners[2]!, rotD]) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, HANDLE * d, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private requestFrame() {
    if (this.frame) return;
    this.frame = requestAnimationFrame((t) => {
      this.frame = 0;
      this.renderFrame(t);
    });
  }

  private renderFrame(t: number) {
    if (this.inertia.moving && !this.nav.size) {
      const step = this.inertia.step(Math.min(50, t - this.coastFrom));
      this.coastFrom = t;
      if (step) {
        const before = this.cam;
        this.setCamera({ ...this.cam, x: this.cam.x + step.dx, y: this.cam.y + step.dy });
        // Stop at the edges instead of pushing against them.
        if (Math.abs(before.x - this.cam.x) + Math.abs(before.y - this.cam.y) < 0.1) this.inertia.reset();
      }
    }
    if (this.dirtyStatic) this.paintStatic();
    this.paintWet();
    this.emit();
  }
}
