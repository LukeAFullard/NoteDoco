import { InputRouter, DEFAULT_ROUTER_SETTINGS, type PointerSample, type RouterSettings } from './inputRouter';
import { normalisePressure, type InkPoint } from './points';
import { PEN_STYLES, strokePath, type PenTool } from './strokeStyle';
import { clampCamera, fitWidth, Inertia, visibleWorld, zoomAt, type Camera, type Size } from './camera';
import { boundsOfPages, drawPaper, layoutPages, pageAt, type PageBox } from './paper';
import { resolveInk } from './inkColours';
import { InkModel, makeStroke, type InkStroke, type StrokeChange } from './model';
import type { Paper } from '@/data/types';
import { newId, nowIso } from '@/lib/ids';

/**
 * The ink canvas core (P3.1–P3.3, ARCHITECTURE §8), grown from the ink-lab spike. It owns
 * input, the camera and rendering; the model (model.ts) owns strokes and undo; the caller
 * owns saving (onChange) and the toolbar (onState).
 *
 * Layers, bottom to top: paper (pages and templates), dry ink (committed strokes, highlighter
 * under pen), wet ink (strokes being drawn, repainted every frame). Each is a viewport-sized
 * canvas at device resolution, redrawn from vectors when the camera moves, so strokes stay
 * crisp at any zoom. Strokes are stored in page coordinates; pages stack vertically.
 */

export type InkTool = PenTool | 'eraser';

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
  zoom: number;
  canUndo: boolean;
  canRedo: boolean;
  strokeCount: number;
  /** The page in the middle of the view (0-based) and how many there are. */
  page: number;
  pageCount: number;
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

interface Active {
  tool: InkTool;
  colour: string;
  size: number;
  page: PageBox;
  points: InkPoint[];
  predicted: InkPoint[];
  pressure: boolean;
  start: number;
  erased: InkStroke[];
}

interface NavGesture {
  start: number;
  maxPointers: number;
  moved: number;
  last: { cx: number; cy: number; d: number } | null;
}

/** Eraser reach in screen pixels. */
const ERASER_RADIUS = 10;

export class InkEngine {
  readonly model: InkModel;
  readonly router: InputRouter;
  settings: EngineSettings;
  tool: InkTool = 'ballpoint';
  colour = 'black';
  size = 1;

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
  private paths = new WeakMap<InkStroke, Path2D>();
  private active = new Map<number, Active>();
  private nav = new Map<number, { x: number; y: number }>();
  private navGesture: NavGesture | null = null;
  private inertia = new Inertia();
  private coastFrom = 0;
  private spaceDown = false;
  private frame = 0;
  private dirtyStatic = true;
  private lastState = '';
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
    const mid = visibleWorld(this.cam, this.view);
    const centre = pageAt(this.boxes, (mid.minX + mid.maxX) / 2, (mid.minY + mid.maxY) / 2);
    return {
      tool: this.tool,
      colour: this.colour,
      size: this.size,
      zoom: Math.round(this.cam.zoom * 100) / 100,
      canUndo: this.model.canUndo,
      canRedo: this.model.canRedo,
      strokeCount: this.model.count,
      page: Math.max(0, this.boxes.findIndex((b) => b.id === centre?.id)),
      pageCount: this.boxes.length,
    };
  }

  get camera(): Camera {
    return { ...this.cam };
  }

  get pageBoxes(): readonly PageBox[] {
    return this.boxes;
  }

  setTool(tool: InkTool) {
    this.tool = tool;
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

  /** New page list (added, reordered, paper changed). Keeps the view where it is. */
  setPages(pages: Array<{ id: string; paper: Paper }>) {
    const gone = this.pages.filter((p) => !pages.some((q) => q.id === p.id));
    for (const p of gone) this.model.dropPage(p.id);
    this.pages = pages;
    this.relayout();
    this.setCamera(this.cam);
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
    this.stopCoasting();
    this.setCamera(zoomAt(this.cam, this.view.w / 2, this.view.h / 2, factor));
  }

  panBy(dx: number, dy: number) {
    this.stopCoasting();
    this.setCamera({ ...this.cam, x: this.cam.x + dx, y: this.cam.y + dy });
  }

  /** Fits the page width to the view, keeping the current page in view. */
  fit() {
    const page = this.boxes[this.state.page];
    const fitted = fitWidth(boundsOfPages(this.boxes), this.view, { maxZoom: 1 });
    const y = page ? 16 - page.y * fitted.zoom : fitted.y;
    this.setCamera({ ...fitted, y });
  }

  scrollToPage(index: number) {
    const page = this.boxes[index];
    if (!page) return;
    this.stopCoasting();
    this.setCamera({ ...this.cam, y: 16 - page.y * this.cam.zoom });
  }

  /** Repaints everything (e.g. the theme changed). */
  invalidate() {
    this.dirtyStatic = true;
    this.requestFrame();
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
    this.setCamera(this.cam);
    this.paintNow();
  }

  private relayout() {
    this.boxes = layoutPages(this.pages, (id) => this.model.contentBottom(id));
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
    const endless = this.boxes.some((b) => b.paper.size === 'endless' || b.paper.size === 'infinite');
    if (endless) this.relayout();
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

  private toPage(e: PointerEvent, a: Pick<Active, 'page' | 'start'>): InkPoint {
    const w = this.toWorld(e);
    return {
      x: w.x - a.page.x,
      y: w.y - a.page.y,
      p: normalisePressure(e.pointerType, e.pressure) ?? 0.5,
      t: Math.max(0, e.timeStamp - a.start),
    };
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
    this.stopCoasting();
    const { role, retract } = this.spaceDown && e.pointerType !== 'touch'
      ? { role: { kind: 'navigate' as const }, retract: [] }
      : this.router.down(this.sample(e));
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
      this.inertia.reset();
      return;
    }

    const w = this.toWorld(e);
    const page = pageAt(this.boxes, w.x, w.y);
    if (!page) return;
    // Pen eraser end, or the barrel button (configurable in P3.10), erases.
    const tool: InkTool = role.tool === 'primary' ? this.tool : 'eraser';
    const a: Active = {
      tool,
      colour: this.colour,
      size: this.size,
      page,
      points: [],
      predicted: [],
      pressure: this.settings.pressure && normalisePressure(e.pointerType, e.pressure) !== null,
      start: e.timeStamp,
      erased: [],
    };
    this.active.set(e.pointerId, a);
    this.addPoints(a, [e]);
  }

  private onMove(e: PointerEvent) {
    if (e.pointerType === 'pen' && e.buttons === 0) {
      this.router.hover(this.sample(e));
      return;
    }
    const a = this.active.get(e.pointerId);
    if (a) {
      const coalesced = this.settings.coalesced && e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      this.addPoints(a, coalesced.length ? coalesced : [e]);
      const predicted = this.settings.prediction && e.getPredictedEvents ? e.getPredictedEvents() : [];
      a.predicted = predicted.map((p) => this.toPage(p, a));
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
      if (cancelled && a.points.length < 2 && a.tool !== 'eraser') this.requestFrame();
      else this.commit(a);
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
    this.stopCoasting();
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

  private stopCoasting() {
    this.inertia.reset();
  }

  /** Drops an in-progress stroke (a palm touched down just before the pen). */
  private discard(pointerId: number) {
    const a = this.active.get(pointerId);
    if (!a) return;
    this.active.delete(pointerId);
    if (a.erased.length) {
      this.model.apply({ added: a.erased, removed: [] });
      this.dirtyStatic = true;
    }
    this.requestFrame();
  }

  // ---- strokes ---------------------------------------------------------------

  private addPoints(a: Active, events: PointerEvent[]) {
    for (const ev of events) {
      const p = this.toPage(ev, a);
      const last = a.points.at(-1);
      if (last && last.x === p.x && last.y === p.y) continue;
      a.points.push(p);
      if (a.tool === 'eraser') this.eraseAt(a, p);
    }
    this.requestFrame();
  }

  private eraseAt(a: Active, p: InkPoint) {
    const gone = this.model.hit(a.page.id, p.x, p.y, ERASER_RADIUS / this.cam.zoom);
    if (!gone.length) return;
    this.model.apply({ added: [], removed: gone });
    a.erased.push(...gone);
    this.dirtyStatic = true;
  }

  private commit(a: Active) {
    if (a.tool === 'eraser') {
      if (a.erased.length) {
        const change = { added: [], removed: a.erased };
        this.model.record(change);
        this.changed(change);
      }
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
    if (stroke.tool === 'highlighter') this.dirtyStatic = true;
    else this.paintStrokeNow(stroke, a.page);
    this.requestFrame();
    this.opts.onChange?.(change);
    if (this.boxes.at(-1)?.id === a.page.id && a.page.paper.size !== 'endless' && stroke.bbox[3] > a.page.h * 0.8) this.opts.onNearEnd?.();
    if (a.page.paper.size === 'endless' || a.page.paper.size === 'infinite') {
      this.relayout();
      this.dirtyStatic = true;
    }
    this.emit();
  }

  // ---- rendering ---------------------------------------------------------------

  private pathOf(s: InkStroke) {
    let p = this.paths.get(s);
    if (!p) {
      p = new Path2D(strokePath({ tool: s.tool, scale: s.size, points: s.points, pressure: s.pressure, complete: true }));
      this.paths.set(s, p);
    }
    return p;
  }

  /** Sets ctx so page coordinates map to device pixels, clipped to the page. */
  private enterPage(ctx: CanvasRenderingContext2D, box: PageBox) {
    const z = this.cam.zoom * this.dpr;
    ctx.save();
    ctx.setTransform(z, 0, 0, z, (this.cam.x + box.x * this.cam.zoom) * this.dpr, (this.cam.y + box.y * this.cam.zoom) * this.dpr);
    ctx.beginPath();
    ctx.rect(0, 0, box.w, box.h);
    ctx.clip();
  }

  private fillStroke(ctx: CanvasRenderingContext2D, s: InkStroke, box: PageBox, path: Path2D) {
    ctx.globalAlpha = PEN_STYLES[s.tool].opacity;
    ctx.fillStyle = resolveInk(s.colour, box.paper.colour);
    ctx.fill(path);
    ctx.globalAlpha = 1;
  }

  private paintStrokeNow(s: InkStroke, box: PageBox) {
    const fresh = this.boxes.find((b) => b.id === box.id) ?? box;
    this.enterPage(this.dryCtx, fresh);
    this.fillStroke(this.dryCtx, s, fresh, this.pathOf(s));
    this.dryCtx.restore();
  }

  private visiblePages() {
    const v = visibleWorld(this.cam, this.view);
    return this.boxes.filter((b) => b.x < v.maxX && b.x + b.w > v.minX && b.y < v.maxY && b.y + b.h > v.minY).map((b) => ({
      box: b,
      rect: { minX: v.minX - b.x, minY: v.minY - b.y, maxX: v.maxX - b.x, maxY: v.maxY - b.y },
    }));
  }

  private paintStatic() {
    for (const ctx of [this.paperCtx, this.dryCtx]) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.paper.width, this.paper.height);
    }
    const px = 1 / this.cam.zoom;
    const shadow = getComputedStyle(this.host).getPropertyValue('--page-shadow').trim() || 'rgba(0,0,0,0.18)';
    for (const { box, rect } of this.visiblePages()) {
      // Paper, with a soft edge so white pages stand out from a light background.
      const pc = this.paperCtx;
      const z = this.cam.zoom * this.dpr;
      pc.save();
      pc.setTransform(z, 0, 0, z, (this.cam.x + box.x * this.cam.zoom) * this.dpr, (this.cam.y + box.y * this.cam.zoom) * this.dpr);
      pc.shadowColor = shadow;
      pc.shadowBlur = 6 * this.dpr;
      pc.fillStyle = '#000';
      pc.fillRect(0, 0, box.w, box.h);
      pc.shadowColor = 'transparent';
      pc.beginPath();
      pc.rect(0, 0, box.w, box.h);
      pc.clip();
      drawPaper(pc, box, px);
      pc.restore();

      // Ink: highlighter first so it never covers pen strokes (INK-2).
      const strokes = this.model.query(box.id, rect);
      this.enterPage(this.dryCtx, box);
      for (const s of strokes) if (s.tool === 'highlighter') this.fillStroke(this.dryCtx, s, box, this.pathOf(s));
      for (const s of strokes) if (s.tool !== 'highlighter') this.fillStroke(this.dryCtx, s, box, this.pathOf(s));
      this.dryCtx.restore();
    }
    this.dirtyStatic = false;
  }

  private paintWet() {
    const ctx = this.wetCtx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.wet.width, this.wet.height);
    for (const a of this.active.values()) {
      if (a.tool === 'eraser' || !a.points.length) continue;
      const pts = a.predicted.length ? [...a.points, ...a.predicted] : a.points;
      const path = new Path2D(strokePath({ tool: a.tool, scale: a.size, points: pts, pressure: a.pressure, complete: false }));
      const box = this.boxes.find((b) => b.id === a.page.id) ?? a.page;
      this.enterPage(ctx, box);
      ctx.globalAlpha = PEN_STYLES[a.tool].opacity;
      ctx.fillStyle = resolveInk(a.colour, box.paper.colour);
      ctx.fill(path);
      ctx.restore();
    }
  }

  private paintNow() {
    this.paintStatic();
    this.paintWet();
    this.emit();
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
