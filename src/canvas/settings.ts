import { DEFAULT_ROUTER_SETTINGS, type RouterSettings } from './inputRouter';

/** Engine settings, kept apart from the engine so settings screens don't load it. */
export interface EngineSettings extends RouterSettings {
  /** Read every hardware sample (getCoalescedEvents). */
  coalesced: boolean;
  /** Draw a predicted tail while writing (getPredictedEvents). Never stored. */
  prediction: boolean;
  /** Ask for a low-latency (desynchronized) canvas for wet ink. */
  lowLatency: boolean;
  /** Use pen pressure where the device reports it. */
  pressure: boolean;
  /** Pressure curve: pressure is raised to this power (below 1 = lighter touch, above 1 = firmer). */
  pressureGamma: number;
  /** What the pen's barrel button does while held. */
  barrel: 'eraser' | 'lasso';
  /** Hold still at the end of a stroke to get a clean shape (INK-11). */
  snapShapes: boolean;
}

export const DEFAULT_ENGINE_SETTINGS: EngineSettings = {
  ...DEFAULT_ROUTER_SETTINGS,
  coalesced: true,
  prediction: true,
  lowLatency: true,
  pressure: true,
  pressureGamma: 1,
  barrel: 'eraser',
  snapShapes: true,
};
