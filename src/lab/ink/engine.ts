import RBush from 'rbush';
import { InputRouter, type PointerSample, type RouterSettings } from '@/canvas/inputRouter';
import { boundsOf, distanceToPolyline, encodePoints, normalisePressure, type InkPoint } from '@/canvas/points';
import { strokePath, type PenTool } from '@/canvas/strokeStyle';
import { InkMetrics } from './metrics';

/**
 * The ink-lab engine (spike P0.7). Framework-free so it can grow into the Phase 3 canvas core.
 *
 * Layers (bottom to top): paper (CSS background on the host), dry canvas (committed strokes),
 * wet canvas (strokes being drawn, repainted every frame). World coordinates are CSS pixels at
 * zoom 1; the camera maps world to screen: screen = world * zoom + offset.
 */

export type LabTool = PenTool | 'eraser';

export interface LabSettings extends RouterSettings {
  coalesced: boolean;
  prediction: boolean;
  lowLatencyCanvas: boolean;
  osInkTrail: boolean;
  rawUpdates: boolean;
  pressure: boolean;
}

export const DEFAULT_LAB_SETTINGS: LabSettings = {
  fingerDraws: true,
  palmSize: 44,
  penGraceMs: 300,
  retractWindowMs: 120,
  coalesced: true,
  prediction: true,
  lowLatencyCanvas: true,
  osInkTrail: false,
  rawUpdates: false,
  pressure: true,
};

interface Stroke {
  id: number;
  tool: PenTool;
  colour: string;
  scale: number;
  points: InkPoint[];
  pressure: boolean;
  path: Path2D;
  bbox: [number, number, number, number];
}

interface BoxItem {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  stroke: Stroke;
}

interface Active {
  tool: LabTool;
  colour: string;
  scale: number;
  points: InkPoint[];
  predicted: InkPoint[];
  pressure: boolean;
  start: number;
  events: number;
  erased: Stroke[];
}

type Op = { type: 'add'; strokes: Stroke[] } | { type: 'remove'; strokes: Stroke[] };

export interface EngineState {
  tool: LabTool;
  colour: string;
  scale: number;
  zoom: number;
  canUndo: boolean;
  canRedo: boolean;
  strokeCount: number;
}

export interface FeatureSupport {
  coalescedEvents: boolean;
  predictedEvents: boolean;
  pointerRawUpdate: boolean;
  inkApi: boolean;
  lowLatencyCanvasGranted: boolean | null;
}

type InkPresenter = { updateInkTrailStartPoint(e: PointerEvent, style: { color: string; diameter: number }): void };

export class InkLabEngine {
  readonly metrics = new InkMetrics();
  readonly router: InputRouter;
  settings: LabSettings;
  tool: LabTool = 'ballpoint';
  colour = '#1c1f22';
  scale = 1;

  private host: HTMLElement;
  private dry: HTMLCanvasElement;
  private wet!: HTMLCanvasElement;
  private dryCtx: CanvasRenderingContext2D;
  private wetCtx!: CanvasRenderingContext2D;
  private dpr = 1;
  private rect: DOMRect = new DOMRect();
  private cam = { x: 0, y: 0, zoom: 1 };
  private strokes: Stroke[] = [];
  private index = new RBush<BoxItem>();
  private boxes = new Map<Stroke, BoxItem>();
  private active = new Map<number, Active>();
  private nav = new Map<number, { x: number; y: number }>();
  private navGesture: { start: number; maxPointers: number; moved: number; last: { cx: number; cy: number; d: number } | null } | null = null;
  private pendingLatency: number[] = [];
  private undoStack: Op[] = [];
  private redoStack: Op[] = [];
  private nextId = 1;
  private frame = 0;
  private dirtyDry = false;
  private presenter: InkPresenter | null = null;
  private resizeObserver: ResizeObserver;
  private listeners: Array<[EventTarget, string, EventListener, AddEventListenerOptions?]> = [];
  private onChange: (s: EngineState) => void;

  constructor(host: HTMLElement, settings: LabSettings, onChange: (s: EngineState) => void) {
    this.host = host;
    this.settings = settings;
    this.onChange = onChange;
    this.router = new InputRouter(settings);
    this.dry = this.makeCanvas('dry');
    this.dryCtx = this.dry.getContext('2d')!;
    this.createWet();

    this.on(host, 'pointerdown', (e) => this.onDown(e as PointerEvent));
    this.on(host, 'pointermove', (e) => this.onMove(e as PointerEvent, 'pointermove'));
    this.on(host, 'pointerrawupdate', (e) => this.onMove(e as PointerEvent, 'pointerrawupdate'));
    this.on(host, 'pointerup', (e) => this.onUp(e as PointerEvent));
    this.on(host, 'pointercancel', (e) => this.onUp(e as PointerEvent, true));
    this.on(host, 'wheel', (e) => this.onWheel(e as WheelEvent), { passive: false });
    // iOS Safari: block the text-selection loupe and callouts that long presses trigger.
    const block = (e: Event) => e.preventDefault();
    this.on(host, 'touchstart', block, { passive: false });
    this.on(host, 'touchmove', block, { passive: false });
    this.on(host, 'contextmenu', block);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();
    void this.setupPresenter();
  }

  destroy() {
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    for (const [t, type, fn, opts] of this.listeners) t.removeEventListener(type, fn, opts);
    this.dry.remove();
    this.wet.remove();
  }

  // ---- public API --------------------------------------------------------

  support(): FeatureSupport {
    const proto = typeof PointerEvent !== 'undefined' ? PointerEvent.prototype : ({} as PointerEvent);
    const attrs = (this.wetCtx as CanvasRenderingContext2D & { getContextAttributes?: () => { desynchronized?: boolean } })
      .getContextAttributes?.();
    return {
      coalescedEvents: 'getCoalescedEvents' in proto,
      predictedEvents: 'getPredictedEvents' in proto,
      pointerRawUpdate: 'onpointerrawupdate' in window,
      inkApi: 'ink' in navigator,
      lowLatencyCanvasGranted: this.settings.lowLatencyCanvas ? (attrs?.desynchronized ?? null) : null,
    };
  }

  updateSettings(next: LabSettings) {
    const recreate = next.lowLatencyCanvas !== this.settings.lowLatencyCanvas;
    this.settings = next;
    this.router.settings = next;
    if (recreate) {
      this.wet.remove();
      this.createWet();
      this.resize();
    }
    void this.setupPresenter();
  }

  setTool(tool: LabTool) {
    this.tool = tool;
    this.emit();
  }

  setColour(colour: string) {
    this.colour = colour;
    this.emit();
  }

  setScale(scale: number) {
    this.scale = scale;
    this.emit();
  }

  undo() {
    const op = this.undoStack.pop();
    if (!op) return false;
    this.apply(op, true);
    this.redoStack.push(op);
    this.emit();
    return true;
  }

  redo() {
    const op = this.redoStack.pop();
    if (!op) return false;
    this.apply(op, false);
    this.undoStack.push(op);
    this.emit();
    return true;
  }

  clear() {
    if (!this.strokes.length) return;
    this.pushOp({ type: 'remove', strokes: [...this.strokes] });
    this.apply({ type: 'remove', strokes: [...this.strokes] }, false);
    this.emit();
  }

  setPaper({ image, colour }: { image: string; colour: string }) {
    this.host.style.backgroundImage = image;
    this.host.style.backgroundColor = colour;
    this.updatePaper();
  }

  resetView() {
    this.cam = { x: 0, y: 0, zoom: 1 };
    this.redrawDry();
    this.emit();
  }

  get camera() {
    return { ...this.cam };
  }

  // ---- canvas setup --------------------------------------------------------

  private makeCanvas(name: string) {
    const c = document.createElement('canvas');
    c.dataset.layer = name;
    c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
    this.host.appendChild(c);
    return c;
  }

  private createWet() {
    this.wet = this.makeCanvas('wet');
    const ctx = this.wet.getContext('2d', { desynchronized: this.settings.lowLatencyCanvas } as CanvasRenderingContext2DSettings);
    this.wetCtx = ctx!;
  }

  private async setupPresenter() {
    this.presenter = null;
    const ink = (navigator as Navigator & { ink?: { requestPresenter(o: { presentationArea: Element }): Promise<InkPresenter> } }).ink;
    if (!this.settings.osInkTrail || !ink) return;
    try {
      this.presenter = await ink.requestPresenter({ presentationArea: this.wet });
    } catch {
      this.presenter = null;
    }
  }

  private resize() {
    const r = (this.rect = this.host.getBoundingClientRect());
    this.dpr = window.devicePixelRatio || 1;
    for (const c of [this.dry, this.wet]) {
      c.width = Math.max(1, Math.round(r.width * this.dpr));
      c.height = Math.max(1, Math.round(r.height * this.dpr));
    }
    this.redrawDry();
  }

  private on(target: EventTarget, type: string, fn: EventListener, opts?: AddEventListenerOptions) {
    target.addEventListener(type, fn, opts);
    this.listeners.push([target, type, fn, opts]);
  }

  private emit() {
    this.onChange({
      tool: this.tool,
      colour: this.colour,
      scale: this.scale,
      zoom: this.cam.zoom,
      canUndo: this.undoStack.length > 0,
      canRedo: this.redoStack.length > 0,
      strokeCount: this.strokes.length,
    });
  }

  // ---- coordinates -------------------------------------------------------

  private toWorld(e: PointerEvent, start: number): InkPoint {
    const r = this.rect; // cached: reading layout per sample would cost time on every pen event
    const pressure = normalisePressure(e.pointerType, e.pressure);
    return {
      x: (e.clientX - r.left - this.cam.x) / this.cam.zoom,
      y: (e.clientY - r.top - this.cam.y) / this.cam.zoom,
      p: pressure ?? 0.5,
      t: Math.max(0, e.timeStamp - start),
    };
  }

  private applyCamera(ctx: CanvasRenderingContext2D) {
    const z = this.cam.zoom * this.dpr;
    ctx.setTransform(z, 0, 0, z, this.cam.x * this.dpr, this.cam.y * this.dpr);
  }

  // ---- input -------------------------------------------------------------

  private sample(e: PointerEvent): PointerSample {
    return {
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      button: e.button,
      buttons: e.buttons,
      width: e.width,
      height: e.height,
      timeStamp: e.timeStamp,
    };
  }

  private onDown(e: PointerEvent) {
    this.rect = this.host.getBoundingClientRect(); // the page may have scrolled since the last resize
    this.metrics.pointerTypes[e.pointerType] = (this.metrics.pointerTypes[e.pointerType] ?? 0) + 1;
    this.metrics.notePointer(e);
    const { role, retract } = this.router.down(this.sample(e));
    for (const id of retract) this.active.delete(id);
    if (retract.length) this.requestFrame();

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

    const tool: LabTool = role.tool === 'primary' ? this.tool : 'eraser';
    const hasPressure = this.settings.pressure && normalisePressure(e.pointerType, e.pressure) !== null;
    const a: Active = {
      tool,
      colour: this.colour,
      scale: this.scale,
      points: [],
      predicted: [],
      pressure: hasPressure,
      start: e.timeStamp,
      events: 0,
      erased: [],
    };
    this.active.set(e.pointerId, a);
    this.addPoints(a, [e]);
  }

  private onMove(e: PointerEvent, type: 'pointermove' | 'pointerrawupdate') {
    if (e.pointerType === 'pen' && e.buttons === 0) {
      this.router.hover(this.sample(e));
      this.metrics.hoverSeen = true;
      return;
    }

    const a = this.active.get(e.pointerId);
    if (a) {
      // Use exactly one event stream for drawing.
      const wantRaw = this.settings.rawUpdates && this.support().pointerRawUpdate;
      if ((type === 'pointerrawupdate') !== wantRaw) return;
      this.metrics.notePointer(e);
      a.events++;
      const coalesced = this.settings.coalesced && e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      this.addPoints(a, coalesced.length ? coalesced : [e]);
      const predicted = this.settings.prediction && e.getPredictedEvents ? e.getPredictedEvents() : [];
      a.predicted = predicted.map((p) => this.toWorld(p, a.start));
      this.pendingLatency.push(e.timeStamp);
      if (this.presenter && a.tool !== 'eraser' && type === 'pointermove') {
        try {
          this.presenter.updateInkTrailStartPoint(e, { color: a.colour, diameter: Math.max(1, 3 * a.scale * this.cam.zoom) });
        } catch {
          /* presenter can reject untrusted or out-of-area events */
        }
      }
      return;
    }

    if (type === 'pointermove' && this.nav.has(e.pointerId)) {
      this.nav.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.updateNavigation();
    }
  }

  private onUp(e: PointerEvent, cancelled = false) {
    this.router.up(this.sample(e));
    const a = this.active.get(e.pointerId);
    if (a) {
      this.active.delete(e.pointerId);
      if (!cancelled || a.points.length > 1) this.commit(a);
      this.requestFrame();
    }
    if (this.nav.delete(e.pointerId) && this.nav.size === 0 && this.navGesture) {
      const g = this.navGesture;
      this.navGesture = null;
      // Quick taps without movement: two fingers = undo, three = redo.
      if (e.timeStamp - g.start < 300 && g.moved < 12) {
        if (g.maxPointers === 2 && this.undo()) this.metrics.gestureUndo++;
        if (g.maxPointers === 3 && this.redo()) this.metrics.gestureRedo++;
      }
    }
  }

  private onWheel(e: WheelEvent) {
    e.preventDefault();
    const r = this.host.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey) {
      this.zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.01));
    } else {
      this.cam.x -= e.deltaX;
      this.cam.y -= e.deltaY;
    }
    this.redrawDry();
    this.emit();
  }

  private navCentre() {
    const pts = [...this.nav.values()];
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    const d = pts.length > 1 ? Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y) : 0;
    return { cx, cy, d };
  }

  private updateNavigation() {
    const g = this.navGesture;
    if (!g) return;
    g.maxPointers = Math.max(g.maxPointers, this.nav.size);
    const now = this.navCentre();
    const last = g.last ?? now;
    const r = this.host.getBoundingClientRect();
    this.cam.x += now.cx - last.cx;
    this.cam.y += now.cy - last.cy;
    if (this.nav.size > 1 && last.d > 0 && now.d > 0) this.zoomAt(now.cx - r.left, now.cy - r.top, now.d / last.d);
    g.moved += Math.hypot(now.cx - last.cx, now.cy - last.cy) + Math.abs(now.d - last.d);
    g.last = now;
    this.dirtyDry = true;
    this.requestFrame();
  }

  private zoomAt(sx: number, sy: number, factor: number) {
    const zoom = Math.min(8, Math.max(0.25, this.cam.zoom * factor));
    const k = zoom / this.cam.zoom;
    this.cam.x = sx - (sx - this.cam.x) * k;
    this.cam.y = sy - (sy - this.cam.y) * k;
    this.cam.zoom = zoom;
  }

  // ---- strokes -----------------------------------------------------------

  private addPoints(a: Active, events: PointerEvent[]) {
    for (const ev of events) {
      const p = this.toWorld(ev, a.start);
      const last = a.points.at(-1);
      if (last && last.x === p.x && last.y === p.y) continue;
      a.points.push(p);
      if (a.tool === 'eraser') this.eraseAt(p, a);
    }
    this.requestFrame();
  }

  private eraseAt(p: InkPoint, a: Active) {
    const radius = 8 / this.cam.zoom;
    const hits = this.index.search({ minX: p.x - radius, minY: p.y - radius, maxX: p.x + radius, maxY: p.y + radius });
    const gone: Stroke[] = [];
    for (const h of hits) {
      const s = h.stroke;
      if (distanceToPolyline(p.x, p.y, s.points) <= radius + s.scale * 2) gone.push(s);
    }
    if (!gone.length) return;
    this.removeStrokes(gone);
    a.erased.push(...gone);
    this.redrawDry();
  }

  private commit(a: Active) {
    if (a.tool === 'eraser') {
      if (a.erased.length) this.pushOp({ type: 'remove', strokes: a.erased });
      this.emit();
      return;
    }
    if (!a.points.length) return;
    const stroke: Stroke = {
      id: this.nextId++,
      tool: a.tool,
      colour: a.colour,
      scale: a.scale,
      points: a.points,
      pressure: a.pressure,
      path: new Path2D(strokePath({ tool: a.tool, scale: a.scale, points: a.points, pressure: a.pressure, complete: true })),
      bbox: boundsOf(a.points, 12 * a.scale),
    };
    const duration = (a.points.at(-1)?.t ?? 0) - (a.points[0]?.t ?? 0);
    this.metrics.noteStroke(a.points.length, a.events, duration);
    this.metrics.strokes++;
    this.metrics.points += a.points.length;
    this.metrics.encodedBytes += encodePoints(a.points).length;
    this.addStrokes([stroke]);
    this.pushOp({ type: 'add', strokes: [stroke] });
    // Highlighter sits under ink, so it needs a full repaint; ink can paint on top incrementally.
    if (stroke.tool === 'highlighter') this.redrawDry();
    else this.paintStroke(this.dryCtx, stroke);
    this.emit();
  }

  private pushOp(op: Op) {
    this.undoStack.push(op);
    this.redoStack = [];
  }

  private apply(op: Op, reverse: boolean) {
    const adding = (op.type === 'add') !== reverse;
    if (adding) this.addStrokes(op.strokes);
    else this.removeStrokes(op.strokes);
    this.redrawDry();
  }

  private addStrokes(list: Stroke[]) {
    for (const s of list) {
      this.strokes.push(s);
      const [minX, minY, maxX, maxY] = s.bbox;
      const box = { minX, minY, maxX, maxY, stroke: s };
      this.boxes.set(s, box);
      this.index.insert(box);
    }
  }

  private removeStrokes(list: Stroke[]) {
    const gone = new Set(list);
    this.strokes = this.strokes.filter((s) => !gone.has(s));
    for (const s of list) {
      const box = this.boxes.get(s);
      if (box) this.index.remove(box);
      this.boxes.delete(s);
    }
  }

  // ---- rendering ---------------------------------------------------------

  private paintStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
    this.applyCamera(ctx);
    ctx.globalAlpha = s.tool === 'highlighter' ? 0.35 : 1;
    ctx.fillStyle = s.colour;
    ctx.fill(s.path);
    ctx.globalAlpha = 1;
  }

  redrawDry() {
    const ctx = this.dryCtx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.dry.width, this.dry.height);
    const r = this.host.getBoundingClientRect();
    const view = {
      minX: -this.cam.x / this.cam.zoom,
      minY: -this.cam.y / this.cam.zoom,
      maxX: (r.width - this.cam.x) / this.cam.zoom,
      maxY: (r.height - this.cam.y) / this.cam.zoom,
    };
    const visible = new Set(this.index.search(view).map((b) => b.stroke));
    const ordered = this.strokes.filter((s) => visible.has(s));
    for (const s of ordered) if (s.tool === 'highlighter') this.paintStroke(ctx, s);
    for (const s of ordered) if (s.tool !== 'highlighter') this.paintStroke(ctx, s);
    this.updatePaper();
    this.dirtyDry = false;
  }

  private updatePaper() {
    const step = 32 * this.cam.zoom;
    this.host.style.backgroundSize = `${step}px ${step}px`;
    this.host.style.backgroundPosition = `${this.cam.x}px ${this.cam.y}px`;
  }

  private requestFrame() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.renderFrame();
    });
  }

  private renderFrame() {
    const t0 = performance.now();
    if (this.dirtyDry) {
      this.redrawDry();
      this.emit();
    }
    const ctx = this.wetCtx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.wet.width, this.wet.height);
    for (const a of this.active.values()) {
      if (a.tool === 'eraser' || !a.points.length) continue;
      const pts = a.predicted.length ? [...a.points, ...a.predicted] : a.points;
      const d = strokePath({ tool: a.tool, scale: a.scale, points: pts, pressure: a.pressure, complete: false });
      this.applyCamera(ctx);
      ctx.globalAlpha = a.tool === 'highlighter' ? 0.35 : 1;
      ctx.fillStyle = a.colour;
      ctx.fill(new Path2D(d));
      ctx.globalAlpha = 1;
    }
    const t1 = performance.now();
    if (this.active.size) this.metrics.noteRender(t1 - t0);
    for (const ts of this.pendingLatency) this.metrics.noteLatency(t1 - ts);
    this.pendingLatency = [];
  }
}
