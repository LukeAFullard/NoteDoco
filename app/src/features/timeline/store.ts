import { create } from 'zustand';
import { readPref, writePref } from '@/lib/localPref';
import { todayLocal } from '@/lib/time';
import type { LocalDate } from '@/data/types';
import type { LaneMode } from './layout';
import type { Zoom } from './scale';

/** What a saved timeline layout remembers (TIME-9), and the per-device current view. */
export interface TimelineView {
  zoom: Zoom;
  laneMode: LaneMode;
  /** Lane order per mode (lane keys). */
  order: Partial<Record<LaneMode, string[]>>;
  /** Hidden lanes per mode. */
  hidden: Partial<Record<LaneMode, string[]>>;
  collapsed: string[];
  /** Show undated items at their created date (TIME-7). */
  undated: boolean;
  /** lanes: time left to right, one row per lane. columns: time top to bottom, one column per lane. */
  orientation: 'lanes' | 'columns';
}

export const DEFAULT_VIEW: TimelineView = { zoom: 'day', laneMode: 'group', order: {}, hidden: {}, collapsed: [], undated: false, orientation: 'lanes' };

interface TimelineState extends TimelineView {
  /** The date the view is centred on; changing it scrolls there. */
  focus: LocalDate;
  /** Bumped to force a scroll to `focus` even when it hasn't changed (the Today button). */
  focusNonce: number;
}

export const useTimeline = create<TimelineState>(() => ({ ...DEFAULT_VIEW, ...readPref<Partial<TimelineView>>('timeline', {}), focus: todayLocal(), focusNonce: 0 }));

const viewOf = (s: TimelineState): TimelineView => ({
  zoom: s.zoom,
  laneMode: s.laneMode,
  order: s.order,
  hidden: s.hidden,
  collapsed: s.collapsed,
  undated: s.undated,
  orientation: s.orientation,
});

export function setView(patch: Partial<TimelineView>) {
  useTimeline.setState(patch);
  writePref('timeline', viewOf(useTimeline.getState()));
}

export const currentView = () => viewOf(useTimeline.getState());

export function jumpTo(day: LocalDate) {
  useTimeline.setState((s) => ({ focus: day, focusNonce: s.focusNonce + 1 }));
}

/** The date in the middle of the timeline's view, so zooming keeps your place. */
let center: LocalDate | null = null;
export const timelineCenter = () => center ?? todayLocal();
export const setTimelineCenter = (day: LocalDate) => {
  center = day;
};
