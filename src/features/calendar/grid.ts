import type { LocalDate, TimeSpan } from '@/data/types';
import type { Placed } from '@/data/agenda';
import { addDays, spanDays, startOfMonth, startOfWeek } from '@/lib/time';

/** The 6×7 days shown for a month (TIME-11), starting on the week's first day. */
export function monthGrid(anchor: LocalDate, weekStart: 0 | 1): LocalDate[] {
  const first = startOfWeek(startOfMonth(anchor), weekStart);
  return Array.from({ length: 42 }, (_, i) => addDays(first, i));
}

export function weekDays(anchor: LocalDate, weekStart: 0 | 1): LocalDate[] {
  const first = startOfWeek(anchor, weekStart);
  return Array.from({ length: 7 }, (_, i) => addDays(first, i));
}

/** Entries on each day (a multi-day span appears on every day it covers). */
export function byDay(placed: Placed[], days: LocalDate[]): Map<LocalDate, Placed[]> {
  const out = new Map<LocalDate, Placed[]>(days.map((d) => [d, []]));
  for (const p of placed) {
    const [a, b] = spanDays(p.span);
    for (let d = a < days[0]! ? days[0]! : a; d <= b && d <= days.at(-1)!; d = addDays(d, 1)) out.get(d)?.push(p);
  }
  return out;
}

/** Minutes after local midnight of `day` (clamped to the day) for a moment. */
export function minutesInDay(iso: string, day: LocalDate): number {
  const d = new Date(iso);
  const midnight = new Date(`${day}T00:00`);
  return Math.max(0, Math.min(1440, (d.getTime() - midnight.getTime()) / 60_000));
}

/** Timed spans on a day as [startMin, endMin], at least `min` minutes long for display. */
export function dayExtent(span: TimeSpan, day: LocalDate, min = 30): [number, number] {
  const a = minutesInDay(span.start, day);
  const b = span.end ? minutesInDay(span.end, day) : a;
  return [a, Math.max(b, a + min)];
}
