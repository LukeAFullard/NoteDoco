import { addDays, addMonths, allDaySpan, diffDays, formatDay, formatSpan, isOverdue, moveSpanTo, shiftSpan, spanDays, spanEnd, startOfWeek, timedSpan, weekday } from './time';

const now = new Date(2026, 8, 26, 12); // Sat 26 Sep 2026, local noon

it('does calendar arithmetic on local dates', () => {
  expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
  expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  expect(diffDays('2026-09-26', '2026-10-03')).toBe(7);
  expect(weekday('2026-09-26')).toBe(6);
  expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
  expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
  expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
  expect(startOfWeek('2026-09-26', 1)).toBe('2026-09-21');
  expect(startOfWeek('2026-09-26', 0)).toBe('2026-09-20');
  expect(startOfWeek('2026-09-21', 1)).toBe('2026-09-21');
});

it('treats all-day ranges as inclusive and timed spans as exact', () => {
  const range = allDaySpan('2026-10-05', '2026-10-07');
  expect(spanDays(range)).toEqual(['2026-10-05', '2026-10-07']);
  expect(spanEnd(range).getDate()).toBe(8);
  const meeting = timedSpan(new Date(2026, 9, 5, 22), new Date(2026, 9, 6, 0));
  expect(spanDays(meeting)).toEqual(['2026-10-05', '2026-10-05']); // ends at midnight: same day
  expect(allDaySpan('2026-10-05', '2026-10-05').end).toBeNull();
});

it('shifts and moves spans keeping their length and time of day', () => {
  expect(shiftSpan(allDaySpan('2026-10-05', '2026-10-07'), 2)).toMatchObject({ start: '2026-10-07', end: '2026-10-09' });
  const t = timedSpan(new Date(2026, 9, 5, 15), new Date(2026, 9, 5, 16));
  const moved = shiftSpan(t, 1);
  expect(new Date(moved.start).getHours()).toBe(15);
  expect(new Date(moved.start).getDate()).toBe(6);
  const toTime = moveSpanTo(t, new Date(2026, 9, 9, 9));
  expect(new Date(toTime.end!).getHours()).toBe(10);
  expect(moveSpanTo(allDaySpan('2026-10-05', '2026-10-06'), new Date(2026, 9, 9))).toMatchObject({ start: '2026-10-09', end: '2026-10-10', allDay: true });
});

it('formats days and spans in words', () => {
  expect(formatDay('2026-09-26', now)).toBe('Today');
  expect(formatDay('2026-09-27', now)).toBe('Tomorrow');
  expect(formatDay('2026-09-25', now)).toBe('Yesterday');
  expect(formatDay('2026-10-02', now)).toMatch(/Fri/);
  expect(formatDay('2027-10-02', now)).toMatch(/2027/);
  expect(formatSpan(timedSpan(new Date(2026, 8, 26, 15), new Date(2026, 8, 26, 16)), now)).toMatch(/^Today, .*–/);
});

it('knows when something is overdue', () => {
  const base = { task: null, archived: false, when: null };
  expect(isOverdue({ ...base, due: allDaySpan('2026-09-25') }, now)).toBe(true);
  expect(isOverdue({ ...base, due: allDaySpan('2026-09-26') }, now)).toBe(false);
  expect(isOverdue({ ...base, due: allDaySpan('2026-09-25'), task: { done: true, doneAt: null } }, now)).toBe(false);
  expect(isOverdue({ ...base, due: timedSpan(new Date(2026, 8, 26, 9)) }, now)).toBe(true);
  // An undone to-do whose date has passed is overdue; a plain dated note isn't.
  expect(isOverdue({ ...base, due: null, when: allDaySpan('2026-09-25'), task: { done: false, doneAt: null } }, now)).toBe(true);
  expect(isOverdue({ ...base, due: null, when: allDaySpan('2026-09-25') }, now)).toBe(false);
});
