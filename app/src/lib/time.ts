import type { Instant, Item, LocalDate, TimeSpan } from '@/data/types';

/**
 * Dates and time spans (ARCHITECTURE §10, "time semantics").
 *
 * - All-day dates are floating `LocalDate`s ("2026-10-02") and never shift with the time zone.
 * - Timed spans are UTC instants plus the zone they were made in, shown in the device's zone.
 * - A span's end is inclusive for all-day ranges (Mon–Wed covers three days) and exact for
 *   timed ones. A missing end means a single day, or a single moment.
 */

export const DAY_MS = 86_400_000;

const pad = (n: number) => String(n).padStart(2, '0');

export const isLocalDate = (s: string): s is LocalDate => /^\d{4}-\d{2}-\d{2}$/.test(s);

/** The device's local calendar date. */
export const toLocalDate = (d: Date): LocalDate => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const todayLocal = (now = new Date()): LocalDate => toLocalDate(now);

/** Local midnight at the start of a LocalDate. */
export function fromLocalDate(s: LocalDate): Date {
  const [y, m, d] = s.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

export function addDays(s: LocalDate, n: number): LocalDate {
  const d = fromLocalDate(s);
  d.setDate(d.getDate() + n);
  return toLocalDate(d);
}

/** Whole days from a to b (b − a), ignoring daylight-saving hours. */
export const diffDays = (a: LocalDate, b: LocalDate): number => Math.round((Date.UTC(...ymd(b)) - Date.UTC(...ymd(a))) / DAY_MS);

function ymd(s: LocalDate): [number, number, number] {
  const [y, m, d] = s.split('-').map(Number) as [number, number, number];
  return [y, m - 1, d];
}

/** 0 = Sunday … 6 = Saturday. */
export const weekday = (s: LocalDate): number => new Date(Date.UTC(...ymd(s))).getUTCDay();

export const daysInMonth = (year: number, month0: number) => new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();

/** Adds months, clamping the day (31 Jan + 1 month = 28 or 29 Feb). */
export function addMonths(s: LocalDate, n: number): LocalDate {
  const [y, m, d] = ymd(s);
  const total = y * 12 + m + n;
  const year = Math.floor(total / 12);
  const month0 = total - year * 12;
  return `${year}-${pad(month0 + 1)}-${pad(Math.min(d, daysInMonth(year, month0)))}`;
}

export const startOfMonth = (s: LocalDate): LocalDate => `${s.slice(0, 8)}01`;

/** 1 = Monday, 0 = Sunday. `auto` asks the browser for the locale's first day. */
export function firstDayOfWeek(pref: 'auto' | 'monday' | 'sunday' = 'auto'): 0 | 1 {
  if (pref === 'monday') return 1;
  if (pref === 'sunday') return 0;
  try {
    const loc = new Intl.Locale(navigator.language) as Intl.Locale & { getWeekInfo?: () => { firstDay: number }; weekInfo?: { firstDay: number } };
    const first = (loc.getWeekInfo?.() ?? loc.weekInfo)?.firstDay;
    if (first === 7) return 0;
  } catch {
    // Older browsers: fall through to Monday.
  }
  return 1;
}

export function startOfWeek(s: LocalDate, first: 0 | 1 = 1): LocalDate {
  return addDays(s, -((weekday(s) - first + 7) % 7));
}

/** The device's IANA time zone, stored with timed spans. */
export const deviceZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;

export function allDaySpan(start: LocalDate, end: LocalDate | null = null): TimeSpan {
  return { start, end: end && end !== start ? end : null, allDay: true, tz: null };
}

export function timedSpan(start: Date, end: Date | null = null): TimeSpan {
  return { start: start.toISOString(), end: end && end > start ? end.toISOString() : null, allDay: false, tz: deviceZone() };
}

/** When the span begins, as a Date (all-day: local midnight). */
export const spanStart = (s: TimeSpan): Date => (s.allDay ? fromLocalDate(s.start) : new Date(s.start));

/** When the span ends, exclusive (all-day: midnight after the last day; a timed point: its start). */
export function spanEnd(s: TimeSpan): Date {
  if (s.allDay) return fromLocalDate(addDays(s.end ?? s.start, 1));
  return new Date(s.end ?? s.start);
}

/** The first and last local dates the span touches. */
export function spanDays(s: TimeSpan): [LocalDate, LocalDate] {
  if (s.allDay) return [s.start, s.end ?? s.start];
  const start = new Date(s.start);
  const end = new Date(s.end ?? s.start);
  // A timed span ending exactly at midnight doesn't touch the next day.
  const last = end > start && end.getHours() === 0 && end.getMinutes() === 0 ? new Date(end.getTime() - 1) : end;
  return [toLocalDate(start), toLocalDate(last)];
}

export const spanTouchesDay = (s: TimeSpan, day: LocalDate): boolean => {
  const [a, b] = spanDays(s);
  return a <= day && day <= b;
};

/** Moves a span by whole days, keeping its local time of day (and length). */
export function shiftSpan(s: TimeSpan, days: number): TimeSpan {
  if (s.allDay) return { ...s, start: addDays(s.start, days), end: s.end ? addDays(s.end, days) : null };
  const move = (iso: Instant) => {
    const d = new Date(iso);
    d.setDate(d.getDate() + days);
    return d.toISOString();
  };
  return { ...s, start: move(s.start), end: s.end ? move(s.end) : null };
}

/** Moves a span so it starts at `to`, keeping its length. */
export function moveSpanTo(s: TimeSpan, to: Date, allDay = s.allDay): TimeSpan {
  const length = spanEnd(s).getTime() - spanStart(s).getTime();
  if (allDay) {
    const days = s.allDay ? diffDays(s.start, s.end ?? s.start) : 0;
    const start = toLocalDate(to);
    return allDaySpan(start, days ? addDays(start, days) : null);
  }
  const keep = s.allDay ? 0 : s.end ? length : 0;
  return { start: to.toISOString(), end: keep ? new Date(to.getTime() + keep).toISOString() : null, allDay: false, tz: s.allDay ? deviceZone() : s.tz };
}

/** The date an item sits at on the timeline and calendar: its scheduled time, else its due date. */
export const itemSpan = (i: Pick<Item, 'when' | 'due'>): TimeSpan | null => i.when ?? i.due;

export const isDone = (i: Pick<Item, 'task'>) => !!i.task?.done;

/** Due before today (or, for timed due dates, before now) and not done or archived. */
export function isOverdue(i: Pick<Item, 'due' | 'task' | 'archived'>, now = new Date()): boolean {
  if (!i.due || isDone(i) || i.archived) return false;
  return i.due.allDay ? (i.due.end ?? i.due.start) < todayLocal(now) : spanEnd(i.due) < now;
}

// ---------------------------------------------------------------------------------------------
// Formatting (always through Intl, so it follows the device's language)

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(undefined, opts);

export const formatTime = (d: Date): string => fmt({ hour: 'numeric', minute: '2-digit' }).format(d);

/** "Today", "Tomorrow", "Yesterday", "Fri 2 Oct", or with the year when it isn't this year. */
export function formatDay(day: LocalDate, now = new Date()): string {
  const today = todayLocal(now);
  const n = diffDays(today, day);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  const sameYear = day.slice(0, 4) === today.slice(0, 4);
  return fmt({ weekday: 'short', day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) }).format(fromLocalDate(day));
}

/** "Wednesday 30 September" for headings. */
export const formatLongDay = (day: LocalDate): string => fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(fromLocalDate(day));

/** A span in a few words: "Today", "Fri 2 Oct, 15:00–16:00", "Mon 5 – Wed 7 Oct". */
export function formatSpan(s: TimeSpan, now = new Date()): string {
  if (s.allDay) {
    if (!s.end) return formatDay(s.start, now);
    return `${formatDay(s.start, now)} – ${formatDay(s.end, now)}`;
  }
  const start = new Date(s.start);
  const startDay = toLocalDate(start);
  const head = `${formatDay(startDay, now)}, ${formatTime(start)}`;
  if (!s.end) return head;
  const end = new Date(s.end);
  const endDay = toLocalDate(end);
  return endDay === startDay ? `${head}–${formatTime(end)}` : `${head} – ${formatDay(endDay, now)}, ${formatTime(end)}`;
}

/** The time part only ("15:00" or "15:00–16:00"), for agenda rows grouped by day. */
export function formatSpanTime(s: TimeSpan): string {
  if (s.allDay) return 'All day';
  const start = formatTime(new Date(s.start));
  return s.end ? `${start}–${formatTime(new Date(s.end))}` : start;
}

/** A `<input type="time">` value ("15:00") for a Date. */
export const timeInputValue = (d: Date): string => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Local date + "HH:MM" → Date. */
export function atTime(day: LocalDate, hhmm: string): Date {
  const d = fromLocalDate(day);
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  d.setHours(h, m, 0, 0);
  return d;
}
