import { byDay, dayExtent, monthGrid, weekDays } from './grid';
import { allDaySpan, timedSpan } from '@/lib/time';
import type { Placed } from '@/data/agenda';

it('lays out a month from the week start', () => {
  const g = monthGrid('2026-09-15', 1);
  expect(g).toHaveLength(42);
  expect(g[0]).toBe('2026-08-31'); // Monday
  expect(monthGrid('2026-09-15', 0)[0]).toBe('2026-08-30'); // Sunday
  expect(weekDays('2026-09-26', 1)).toEqual(['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27']);
});

it('puts multi-day spans on every day they cover', () => {
  const p = { span: allDaySpan('2026-09-20', '2026-09-23') } as Placed;
  const m = byDay([p], weekDays('2026-09-24', 1));
  expect([...m].filter(([, v]) => v.length).map(([d]) => d)).toEqual(['2026-09-21', '2026-09-22', '2026-09-23']);
});

it('measures timed spans within a day', () => {
  expect(dayExtent(timedSpan(new Date(2026, 8, 26, 9, 30), new Date(2026, 8, 26, 11)), '2026-09-26')).toEqual([570, 660]);
  expect(dayExtent(timedSpan(new Date(2026, 8, 26, 23), new Date(2026, 8, 27, 2)), '2026-09-27')).toEqual([0, 120]);
  expect(dayExtent(timedSpan(new Date(2026, 8, 26, 9)), '2026-09-26')).toEqual([540, 570]);
});
