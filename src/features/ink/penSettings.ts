import { create } from 'zustand';
import { readPref, writePref } from '@/lib/localPref';
import { DEFAULT_ENGINE_SETTINGS, type EngineSettings } from '@/canvas/settings';

/**
 * Pen settings (P3.10, INK-23), per device. The palm-rejection numbers are starting points:
 * they'll be tuned from the iPad ink-lab report (decision 0004), so they're adjustable here.
 */
export interface PenSettings {
  hand: 'right' | 'left';
  toolbar: 'top' | 'side' | 'bottom';
  pressure: 'off' | 'light' | 'normal' | 'firm';
  fingers: 'auto' | 'always' | 'never';
  barrel: 'eraser' | 'lasso';
  snapShapes: boolean;
  prediction: boolean;
  /** Touches wider or taller than this (CSS px) are treated as a palm. */
  palmSize: number;
  /** Touches are ignored for this long after the pen lifts (ms). */
  penGraceMs: number;
}

export const DEFAULT_PEN_SETTINGS: PenSettings = {
  hand: 'right',
  toolbar: 'top',
  pressure: 'normal',
  fingers: 'auto',
  barrel: 'eraser',
  snapShapes: true,
  prediction: true,
  palmSize: DEFAULT_ENGINE_SETTINGS.palmSize,
  penGraceMs: DEFAULT_ENGINE_SETTINGS.penGraceMs,
};

const KEY = 'ink.settings';

export const usePenSettings = create<PenSettings>(() => ({ ...DEFAULT_PEN_SETTINGS, ...readPref<Partial<PenSettings>>(KEY, {}) }));

export function setPenSettings(patch: Partial<PenSettings>) {
  usePenSettings.setState(patch);
  writePref(KEY, usePenSettings.getState());
}

export const resetPenSettings = () => setPenSettings(DEFAULT_PEN_SETTINGS);

const GAMMA = { off: 1, light: 0.6, normal: 1, firm: 1.6 } as const;

/** What the engine needs from the settings. */
export function engineSettings(p: PenSettings): EngineSettings {
  return {
    ...DEFAULT_ENGINE_SETTINGS,
    fingerDraws: p.fingers !== 'never',
    fingerAlways: p.fingers === 'always',
    palmSize: p.palmSize,
    penGraceMs: p.penGraceMs,
    prediction: p.prediction,
    pressure: p.pressure !== 'off',
    pressureGamma: GAMMA[p.pressure],
    barrel: p.barrel,
    snapShapes: p.snapShapes,
  };
}
