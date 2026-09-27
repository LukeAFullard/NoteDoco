import type { LocalDate, TimeSpan } from '@/data/types';
import { addDays, diffDays, fromLocalDate, toLocalDate, weekday } from '@/lib/time';

/**
 * The timeline's time scale (TIME-5, ARCHITECTURE §10).
 *
 * Every local day is the same width, so days line up with the calendar and daylight-saving
 * changes don't bend the axis: x = (days since origin + fraction of that local day) × px/day.
 * The scale covers a window around a centre date; scrolling near an edge re-centres it.
 */

export type Zoom = 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
export const ZOOMS: Zoom[] = ['hour', 'day', 'week', 'month', 'quarter', 'year'];
export const ZOOM_LABELS: Record<Zoom, string> = { hour: 'Hours', day: 'Days', week: 'Weeks', month: 'Months', quarter: 'Quarters', year: 'Years' };

const PX_PER_DAY: Record<Zoom, number> = { hour: 1440, day: 160, week: 48, month: 16, quarter: 5, year: 1.6 };
/** Days either side of the centre. */
const RANGE_DAYS: Record<Zoom, number> = { hour: 21, day: 370, week: 740, month: 1500, quarter: 3700, year: 7400 };

/** How items are drawn at each zoom: full cards, compact chips, or density bars. */
export type Detail = 'card' | 'chip' | 'density';
export const DETAIL: Record<Zoom, Detail> = { hour: 'card', day: 'card', week: 'card', month: 'chip', quarter: 'chip', year: 'density' };

export interface Scale {
  zoom: Zoom;
  origin: LocalDate;
  days: number;
  pxPerDay: number;
  /** Length of the whole axis in px. */
  length: number;
}

export function makeScale(zoom: Zoom, center: LocalDate): Scale {
  const range = RANGE_DAYS[zoom];
  const days = range * 2 + 1;
  return { zoom, origin: addDays(center, -range), days, pxPerDay: PX_PER_DAY[zoom], length: days * PX_PER_DAY[zoom] };
}

/** How far through its local day a moment is, 0–1 (exact on 23- and 25-hour days). */
function fractionOfDay(d: Date): number {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  return (d.getTime() - start.getTime()) / (end.getTime() - start.getTime());
}

export const posOfDay = (s: Scale, day: LocalDate): number => diffDays(s.origin, day) * s.pxPerDay;
export const posOfDate = (s: Scale, d: Date): number => (diffDays(s.origin, toLocalDate(d)) + fractionOfDay(d)) * s.pxPerDay;

/** The local day at a position. */
export const dayAtPos = (s: Scale, pos: number): LocalDate => addDays(s.origin, Math.floor(pos / s.pxPerDay));

/** The moment at a position. */
export function dateAtPos(s: Scale, pos: number): Date {
  const dayIndex = Math.floor(pos / s.pxPerDay);
  const frac = pos / s.pxPerDay - dayIndex;
  const start = fromLocalDate(addDays(s.origin, dayIndex));
  const end = fromLocalDate(addDays(s.origin, dayIndex + 1));
  return new Date(start.getTime() + frac * (end.getTime() - start.getTime()));
}

/** Where a span starts and ends on the axis. A timed moment has zero length. */
export function spanExtent(s: Scale, span: TimeSpan): [number, number] {
  if (span.allDay) return [posOfDay(s, span.start), posOfDay(s, addDays(span.end ?? span.start, 1))];
  const a = posOfDate(s, new Date(span.start));
  return [a, span.end ? posOfDate(s, new Date(span.end)) : a];
}

/** Snapping for dragging timed items: minutes at fine zooms, whole days otherwise. */
export const SNAP_MINUTES: Record<Zoom, number> = { hour: 15, day: 30, week: 1440, month: 1440, quarter: 1440, year: 1440 };

/** The step for Alt+arrow rescheduling and the "one unit" of each zoom, in minutes. */
export const STEP_MINUTES: Record<Zoom, number> = { hour: 60, day: 1440, week: 1440, month: 1440, quarter: 1440, year: 1440 };

/** The next zoom level in or out, or the same one at the ends. */
export function zoomBy(z: Zoom, dir: 1 | -1): Zoom {
  return ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, ZOOMS.indexOf(z) + dir))]!;
}

// ---------------------------------------------------------------------------------------------
// Ticks

export interface Tick {
  pos: number;
  label: string;
  /** For shading: a Saturday or Sunday (only at day-sized zooms). */
  weekend?: boolean;
  day: LocalDate;
}

const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(undefined, o);

/** Major (top row) and minor (bottom row) ticks for [from, to] positions. */
export function ticks(s: Scale, from: number, to: number): { major: Tick[]; minor: Tick[] } {
  const first = dayAtPos(s, Math.max(0, from));
  const last = dayAtPos(s, Math.min(s.length - 1, to));
  const major: Tick[] = [];
  const minor: Tick[] = [];
  const dayFmt = fmt({ weekday: 'short', day: 'numeric', month: 'short' });
  const monthYear = fmt({ month: 'long', year: 'numeric' });
  const shortMonthYear = fmt({ month: 'short', year: 'numeric' });
  const month = fmt({ month: 'short' });
  const narrowMonth = fmt({ month: 'narrow' });
  const weekdayDay = fmt({ weekday: 'short', day: 'numeric' });
  const hour = fmt({ hour: 'numeric' });

  for (let day = first; day <= last; day = addDays(day, 1)) {
    const pos = posOfDay(s, day);
    const d = fromLocalDate(day);
    const wd = weekday(day);
    const weekend = wd === 0 || wd === 6;
    const firstOfMonth = day.endsWith('-01');
    const firstOfYear = day.endsWith('-01-01');
    switch (s.zoom) {
      case 'hour':
        major.push({ pos, label: dayFmt.format(d), day, weekend });
        for (let h = 0; h < 24; h++) {
          const at = new Date(d);
          at.setHours(h);
          minor.push({ pos: posOfDate(s, at), label: hour.format(at), day });
        }
        break;
      case 'day':
        if (firstOfMonth || day === first) major.push({ pos, label: monthYear.format(d), day });
        minor.push({ pos, label: weekdayDay.format(d), day, weekend });
        break;
      case 'week':
        if (firstOfMonth || day === first) major.push({ pos, label: monthYear.format(d), day });
        minor.push({ pos, label: String(d.getDate()), day, weekend });
        break;
      case 'month':
        if (firstOfMonth || day === first) major.push({ pos, label: shortMonthYear.format(d), day });
        if (wd === 1) minor.push({ pos, label: String(d.getDate()), day });
        break;
      case 'quarter':
        if (firstOfYear || day === first) major.push({ pos, label: String(d.getFullYear()), day });
        if (firstOfMonth) minor.push({ pos, label: month.format(d), day });
        break;
      case 'year':
        if (firstOfYear || day === first) major.push({ pos, label: String(d.getFullYear()), day });
        if (firstOfMonth) minor.push({ pos, label: narrowMonth.format(d), day });
        break;
    }
  }
  return { major, minor };
}
