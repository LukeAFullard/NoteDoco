/**
 * Decides what each pointer does on an ink canvas: draw, navigate (pan/zoom) or be ignored.
 * The web has no "palm" flag, so this is a heuristic state machine (ARCHITECTURE §8.1):
 *  - the pen always wins;
 *  - touches are ignored while a pen is down or hovering, and briefly after pen-up;
 *  - large contact areas are treated as palms;
 *  - once a pen has been seen, fingers navigate instead of drawing (unless finger drawing is
 *    set to "always");
 *  - a second finger turns a one-finger stroke into a pan or pinch (the stroke is retracted);
 *  - a touch stroke that started just before a pen arrives is retracted.
 * Pure and clock-injected so it can be unit tested with recorded pointer sequences.
 */

export interface PointerSample {
  pointerId: number;
  pointerType: string; // 'pen' | 'touch' | 'mouse'
  button: number;
  buttons: number;
  width: number;
  height: number;
  timeStamp: number;
}

export type Role =
  | { kind: 'draw'; tool: 'primary' | 'eraser' | 'secondary' }
  | { kind: 'navigate' }
  | { kind: 'ignore'; reason: 'palm-size' | 'pen-active' | 'pen-recent' };

export interface RouterSettings {
  /** Let fingers draw when no pen has been seen. */
  fingerDraws: boolean;
  /** Let fingers draw even after a pen has been seen (palm rejection then relies on size). */
  fingerAlways?: boolean;
  /** Touches with width or height (CSS px) above this are palms. */
  palmSize: number;
  /** Ignore touches for this long after the pen lifts. */
  penGraceMs: number;
  /** A touch stroke younger than this is retracted when a pen goes down. */
  retractWindowMs: number;
}

export const DEFAULT_ROUTER_SETTINGS: RouterSettings = {
  fingerDraws: true,
  palmSize: 44,
  penGraceMs: 300,
  retractWindowMs: 120,
};

export interface DownResult {
  role: Role;
  /** Pointer ids whose in-progress strokes should be discarded (palm arrived first). */
  retract: number[];
}

export class InputRouter {
  penSeen = false;
  private pensDown = new Set<number>();
  private penHoverUntil = -Infinity;
  private lastPenUp = -Infinity;
  private touchDraws = new Map<number, number>(); // pointerId -> start time
  readonly stats = { palmsRejected: 0, retracted: 0 };

  constructor(public settings: RouterSettings = DEFAULT_ROUTER_SETTINGS) {}

  /** Call for pen pointermove without buttons: the pen is hovering (supported hardware only). */
  hover(e: PointerSample) {
    if (e.pointerType === 'pen') {
      this.penSeen = true;
      this.penHoverUntil = e.timeStamp + this.settings.penGraceMs;
    }
  }

  down(e: PointerSample): DownResult {
    const s = this.settings;
    if (e.pointerType === 'pen') {
      this.penSeen = true;
      this.pensDown.add(e.pointerId);
      const retract = [...this.touchDraws].filter(([, t]) => e.timeStamp - t <= s.retractWindowMs).map(([id]) => id);
      retract.forEach((id) => this.touchDraws.delete(id));
      this.stats.retracted += retract.length;
      // Eraser end (buttons bit 32) or barrel button (bit 2).
      const tool = e.buttons & 32 || e.button === 5 ? 'eraser' : e.buttons & 2 ? 'secondary' : 'primary';
      return { role: { kind: 'draw', tool }, retract };
    }

    if (e.pointerType === 'touch') {
      if (this.pensDown.size > 0) return this.reject('pen-active');
      if (e.timeStamp < this.penHoverUntil) return this.reject('pen-active');
      if (e.timeStamp - this.lastPenUp < s.penGraceMs) return this.reject('pen-recent');
      if (e.width > s.palmSize || e.height > s.palmSize) return this.reject('palm-size');
      if ((this.penSeen && !s.fingerAlways) || !s.fingerDraws) return { role: { kind: 'navigate' }, retract: [] };
      if (this.touchDraws.size) {
        // A second finger: this is a pan or pinch, not two strokes.
        const retract = [...this.touchDraws.keys()];
        this.touchDraws.clear();
        this.stats.retracted += retract.length;
        return { role: { kind: 'navigate' }, retract };
      }
      this.touchDraws.set(e.pointerId, e.timeStamp);
      return { role: { kind: 'draw', tool: 'primary' }, retract: [] };
    }

    // Mouse (and anything else): left draws, middle navigates, right is left to menus.
    if (e.button === 1) return { role: { kind: 'navigate' }, retract: [] };
    if (e.button === 0) return { role: { kind: 'draw', tool: 'primary' }, retract: [] };
    return { role: { kind: 'ignore', reason: 'pen-active' }, retract: [] };
  }

  up(e: PointerSample) {
    if (e.pointerType === 'pen') {
      this.pensDown.delete(e.pointerId);
      this.lastPenUp = e.timeStamp;
    }
    this.touchDraws.delete(e.pointerId);
  }

  private reject(reason: 'palm-size' | 'pen-active' | 'pen-recent'): DownResult {
    this.stats.palmsRejected++;
    return { role: { kind: 'ignore', reason }, retract: [] };
  }
}
