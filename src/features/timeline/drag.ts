import type { TimeSpan } from '@/data/types';
import { addDays, allDaySpan, shiftSpan } from '@/lib/time';
import { SNAP_MINUTES, type Scale } from './scale';

export type DragKind = 'move' | 'start' | 'end';

/** Applies a drag of `px` along the axis to a span, snapped for the zoom (TIME-6). */
export function draggedSpan(span: TimeSpan, kind: DragKind, px: number, scale: Scale): TimeSpan {
  const days = px / scale.pxPerDay;
  const snap = SNAP_MINUTES[scale.zoom];
  if (span.allDay || snap >= 1440) {
    const n = Math.round(days);
    if (kind === 'move') return shiftSpan(span, n);
    if (span.allDay) {
      const end = span.end ?? span.start;
      if (kind === 'end') {
        const e = addDays(end, n);
        return allDaySpan(span.start, e < span.start ? span.start : e);
      }
      const s = addDays(span.start, n);
      return allDaySpan(s > end ? end : s, end);
    }
    // Timed, zoomed out: move an end by whole days, keeping its time of day.
    const moved = shiftSpan({ ...span, start: kind === 'start' ? span.start : (span.end ?? span.start), end: null }, n).start;
    if (kind === 'start') return moved < (span.end ?? span.start) ? { ...span, start: moved } : span;
    return moved > span.start ? { ...span, end: moved } : span;
  }
  const mins = Math.round((days * 1440) / snap) * snap;
  const ms = mins * 60_000;
  const start = Date.parse(span.start);
  const end = Date.parse(span.end ?? span.start);
  if (kind === 'move') return { ...span, start: new Date(start + ms).toISOString(), end: span.end ? new Date(end + ms).toISOString() : null };
  if (kind === 'end') {
    const e = Math.max(start + snap * 60_000, end + ms);
    return { ...span, end: new Date(e).toISOString() };
  }
  const s = Math.min(end - snap * 60_000, start + ms);
  return { ...span, start: new Date(s).toISOString(), end: span.end ?? new Date(end).toISOString() };
}

