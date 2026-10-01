/**
 * The camera for ink pages and boards (ARCHITECTURE §8, §9). World coordinates are CSS
 * pixels at zoom 1. Screen = world × zoom + offset, so `x` and `y` are where the world origin
 * appears on screen. Pure functions, so they can be unit tested.
 */

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export interface Size {
  w: number;
  h: number;
}

export interface Rect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 8;

export const toWorld = (cam: Camera, sx: number, sy: number) => ({ x: (sx - cam.x) / cam.zoom, y: (sy - cam.y) / cam.zoom });
export const toScreen = (cam: Camera, wx: number, wy: number) => ({ x: wx * cam.zoom + cam.x, y: wy * cam.zoom + cam.y });

/** The part of the world on screen. */
export function visibleWorld(cam: Camera, view: Size): Rect {
  return { minX: -cam.x / cam.zoom, minY: -cam.y / cam.zoom, maxX: (view.w - cam.x) / cam.zoom, maxY: (view.h - cam.y) / cam.zoom };
}

/** Zooms by `factor` keeping the world point under screen point (sx, sy) still. */
export function zoomAt(cam: Camera, sx: number, sy: number, factor: number, min = MIN_ZOOM, max = MAX_ZOOM): Camera {
  const zoom = Math.min(max, Math.max(min, cam.zoom * factor));
  const k = zoom / cam.zoom;
  return { x: sx - (sx - cam.x) * k, y: sy - (sy - cam.y) * k, zoom };
}

/** Centres `content` horizontally at a zoom that fits its width (with padding), top-aligned. */
export function fitWidth(content: Rect, view: Size, { pad = 16, maxZoom = 1.25 } = {}): Camera {
  const w = content.maxX - content.minX;
  const zoom = Math.max(MIN_ZOOM, Math.min(maxZoom, (view.w - pad * 2) / Math.max(1, w)));
  return { zoom, x: (view.w - w * zoom) / 2 - content.minX * zoom, y: pad - content.minY * zoom };
}

/**
 * Keeps the content reachable: along each axis, content smaller than the view stays centred
 * (horizontally) or within the view, and larger content can't be dragged further than
 * `margin` screen pixels past its edges.
 */
export function clampCamera(cam: Camera, view: Size, content: Rect, margin = 48): Camera {
  const clampAxis = (offset: number, min: number, max: number, size: number, centre: boolean) => {
    const lo = min * cam.zoom;
    const hi = max * cam.zoom;
    if (hi - lo <= size - margin * 2) {
      if (centre) return (size - (hi - lo)) / 2 - lo;
      return Math.min(size - margin - hi, Math.max(margin - lo, offset));
    }
    return Math.min(margin - lo, Math.max(size - margin - hi, offset));
  };
  return {
    zoom: cam.zoom,
    x: clampAxis(cam.x, content.minX, content.maxX, view.w, true),
    y: clampAxis(cam.y, content.minY, content.maxY, view.h, false),
  };
}

/**
 * Fling momentum after a pan: track recent positions, then on release coast with an
 * exponential slowdown (time constant ~325 ms, like iOS scrolling).
 */
export class Inertia {
  private samples: Array<{ x: number; y: number; t: number }> = [];
  private vx = 0;
  private vy = 0;
  static readonly TIME_CONSTANT = 325;
  static readonly MIN_SPEED = 0.02; // px per ms

  reset() {
    this.samples = [];
    this.vx = this.vy = 0;
  }

  track(x: number, y: number, t: number) {
    this.samples.push({ x, y, t });
    while (this.samples.length > 2 && t - this.samples[0]!.t > 100) this.samples.shift();
  }

  /** Starts coasting; returns false when the release was too slow to fling. */
  release(t: number): boolean {
    const first = this.samples[0];
    const last = this.samples.at(-1);
    this.samples = [];
    if (!first || !last || last === first || t - last.t > 60) return false;
    const dt = Math.max(1, last.t - first.t);
    this.vx = (last.x - first.x) / dt;
    this.vy = (last.y - first.y) / dt;
    return Math.hypot(this.vx, this.vy) >= Inertia.MIN_SPEED * 5;
  }

  /** Distance to move over the next `dt` ms, or null once it has come to rest. */
  step(dt: number): { dx: number; dy: number } | null {
    if (Math.hypot(this.vx, this.vy) < Inertia.MIN_SPEED) {
      this.vx = this.vy = 0;
      return null;
    }
    const decay = Math.exp(-dt / Inertia.TIME_CONSTANT);
    // Integral of v·e^(-t/τ) over dt.
    const k = Inertia.TIME_CONSTANT * (1 - decay);
    const out = { dx: this.vx * k, dy: this.vy * k };
    this.vx *= decay;
    this.vy *= decay;
    return out;
  }

  get moving() {
    return this.vx !== 0 || this.vy !== 0;
  }
}
