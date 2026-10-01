import type { LocalDate } from '@/data/types';
import { addDays, addMonths, daysInMonth, diffDays, weekday } from './time';

/**
 * Repeats (TIME-15): a small subset of RFC 5545 RRULE, stored as a string on the item so it
 * exports to .ics unchanged.
 *
 * Supported: FREQ=DAILY|WEEKLY|MONTHLY|YEARLY, INTERVAL, BYDAY (weekly only), UNTIL (a date).
 * One extension: X-NDOCO-MODE=COPY marks a template ("each time, start a fresh copy"); it's
 * dropped on .ics export.
 *
 * Monthly and yearly repeats keep the anchor's day, clamped to short months (the 31st repeats
 * on the 30th in September), which is what people expect, even though strict RRULE skips them.
 */

export type Freq = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export interface Rule {
  freq: Freq;
  interval: number;
  /** Weekdays for weekly repeats, 0 = Sunday. Null = the anchor's weekday. */
  byDay: number[] | null;
  until: LocalDate | null;
  /** move: the item moves to its next date when done. copy: each time, a fresh copy is made. */
  mode: 'move' | 'copy';
}

const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;
const FREQS: Freq[] = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'];

export function parseRule(s: string | null | undefined): Rule | null {
  if (!s) return null;
  const parts = new Map(
    s
      .replace(/^RRULE:/i, '')
      .split(';')
      .map((p) => p.split('=') as [string, string])
      .filter(([k, v]) => k && v)
      .map(([k, v]) => [k.toUpperCase(), v.toUpperCase()]),
  );
  const freq = parts.get('FREQ') as Freq | undefined;
  if (!freq || !FREQS.includes(freq)) return null;
  const interval = Math.max(1, Number(parts.get('INTERVAL') ?? 1) || 1);
  const byDay = parts.get('BYDAY')
    ? parts
        .get('BYDAY')!
        .split(',')
        .map((c) => DAY_CODES.indexOf(c.slice(-2) as (typeof DAY_CODES)[number]))
        .filter((d) => d >= 0)
        .sort()
    : null;
  const u = parts.get('UNTIL');
  const until = u && /^\d{8}/.test(u) ? `${u.slice(0, 4)}-${u.slice(4, 6)}-${u.slice(6, 8)}` : null;
  return { freq, interval, byDay: byDay?.length ? byDay : null, until, mode: parts.get('X-NDOCO-MODE') === 'COPY' ? 'copy' : 'move' };
}

export function formatRule(r: Rule, { forIcs = false } = {}): string {
  const parts = [`FREQ=${r.freq}`];
  if (r.interval > 1) parts.push(`INTERVAL=${r.interval}`);
  if (r.freq === 'WEEKLY' && r.byDay?.length) parts.push(`BYDAY=${r.byDay.map((d) => DAY_CODES[d]).join(',')}`);
  if (r.until) parts.push(`UNTIL=${r.until.replaceAll('-', '')}`);
  if (r.mode === 'copy' && !forIcs) parts.push('X-NDOCO-MODE=COPY');
  return parts.join(';');
}

const WEEKDAYS = [1, 2, 3, 4, 5];
const dayName = (d: number, style: 'long' | 'short') =>
  new Intl.DateTimeFormat(undefined, { weekday: style }).format(new Date(Date.UTC(2024, 0, 7 + d))); // 7 Jan 2024 was a Sunday

/** "Every day", "Every weekday", "Weekly on Mon, Thu", "Every 2 weeks on Fri", "Monthly", "Yearly". */
export function describeRule(r: Rule): string {
  const every = (unit: string, units: string) => (r.interval === 1 ? unit : `Every ${r.interval} ${units}`);
  let text: string;
  switch (r.freq) {
    case 'DAILY':
      text = r.interval === 1 ? 'Every day' : `Every ${r.interval} days`;
      break;
    case 'WEEKLY': {
      if (r.interval === 1 && r.byDay?.join() === WEEKDAYS.join()) {
        text = 'Every weekday';
        break;
      }
      const days = r.byDay?.length ? ` on ${r.byDay.map((d) => dayName(d, 'short')).join(', ')}` : '';
      text = `${every('Weekly', 'weeks')}${days}`;
      break;
    }
    case 'MONTHLY':
      text = every('Monthly', 'months');
      break;
    case 'YEARLY':
      text = every('Yearly', 'years');
      break;
  }
  return r.until ? `${text}, until ${r.until}` : text;
}

/** Whether `day` is an occurrence of a rule that starts on `anchor`. */
export function occursOn(r: Rule, anchor: LocalDate, day: LocalDate): boolean {
  if (day < anchor || (r.until && day > r.until)) return false;
  const [ay, am, ad] = anchor.split('-').map(Number) as [number, number, number];
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  switch (r.freq) {
    case 'DAILY':
      return diffDays(anchor, day) % r.interval === 0;
    case 'WEEKLY': {
      const days = r.byDay ?? [weekday(anchor)];
      if (!days.includes(weekday(day))) return false;
      // Weeks counted Monday to Sunday from the anchor's week (RRULE's default WKST=MO).
      const monday = (s: LocalDate) => addDays(s, -((weekday(s) + 6) % 7));
      return (diffDays(monday(anchor), monday(day)) / 7) % r.interval === 0;
    }
    case 'MONTHLY': {
      const months = (y - ay) * 12 + (m - am);
      return months % r.interval === 0 && d === Math.min(ad, daysInMonth(y, m - 1));
    }
    case 'YEARLY':
      return (y - ay) % r.interval === 0 && m === am && d === Math.min(ad, daysInMonth(y, m - 1));
  }
}

/** Occurrences within [from, to], inclusive (at most `limit`). */
export function occurrencesBetween(r: Rule, anchor: LocalDate, from: LocalDate, to: LocalDate, limit = 1000): LocalDate[] {
  const out: LocalDate[] = [];
  const last = r.until && r.until < to ? r.until : to;
  let day = from > anchor ? from : anchor;
  // Monthly and yearly repeats jump month by month rather than testing every day.
  if (r.freq === 'MONTHLY' || r.freq === 'YEARLY') {
    const step = r.freq === 'MONTHLY' ? r.interval : r.interval * 12;
    for (let k = 0; out.length < limit; k += step) {
      const occ = addMonths(anchor, k);
      if (occ > last) break;
      if (occ >= day) out.push(occ);
    }
    return out;
  }
  while (day <= last && out.length < limit) {
    if (occursOn(r, anchor, day)) out.push(day);
    day = addDays(day, 1);
  }
  return out;
}

/** The first occurrence strictly after `after`, or null when the repeat has ended. */
export function nextOccurrence(r: Rule, anchor: LocalDate, after: LocalDate): LocalDate | null {
  const from = addDays(after, 1);
  // Enough room for any supported rule: interval × a year, plus slack.
  const horizon = addDays(from, 370 * Math.max(1, r.interval) + 31);
  return occurrencesBetween(r, anchor, from, horizon, 1)[0] ?? null;
}

/** Presets offered in the date editor. */
export const PRESETS: { label: string; rule: (anchor: LocalDate) => Rule }[] = [
  { label: 'Every day', rule: () => ({ freq: 'DAILY', interval: 1, byDay: null, until: null, mode: 'move' }) },
  { label: 'Every weekday', rule: () => ({ freq: 'WEEKLY', interval: 1, byDay: WEEKDAYS, until: null, mode: 'move' }) },
  { label: 'Weekly', rule: (a) => ({ freq: 'WEEKLY', interval: 1, byDay: [weekday(a)], until: null, mode: 'move' }) },
  { label: 'Every 2 weeks', rule: (a) => ({ freq: 'WEEKLY', interval: 2, byDay: [weekday(a)], until: null, mode: 'move' }) },
  { label: 'Monthly', rule: () => ({ freq: 'MONTHLY', interval: 1, byDay: null, until: null, mode: 'move' }) },
  { label: 'Yearly', rule: () => ({ freq: 'YEARLY', interval: 1, byDay: null, until: null, mode: 'move' }) },
];

export { dayName };
