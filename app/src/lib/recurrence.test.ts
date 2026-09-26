import { describeRule, formatRule, nextOccurrence, occurrencesBetween, parseRule } from './recurrence';

it('parses and formats the supported RRULE subset', () => {
  const r = parseRule('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH;UNTIL=20261231');
  expect(r).toEqual({ freq: 'WEEKLY', interval: 2, byDay: [1, 4], until: '2026-12-31', mode: 'move' });
  expect(formatRule(r!)).toBe('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH;UNTIL=20261231');
  expect(parseRule('FREQ=DAILY;X-NDOCO-MODE=COPY')!.mode).toBe('copy');
  expect(formatRule(parseRule('FREQ=DAILY;X-NDOCO-MODE=COPY')!, { forIcs: true })).toBe('FREQ=DAILY');
  expect(parseRule('FREQ=HOURLY')).toBeNull();
  expect(parseRule(null)).toBeNull();
});

it('describes rules in words', () => {
  expect(describeRule(parseRule('FREQ=DAILY')!)).toBe('Every day');
  expect(describeRule(parseRule('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR')!)).toBe('Every weekday');
  expect(describeRule(parseRule('FREQ=WEEKLY;INTERVAL=2;BYDAY=FR')!)).toMatch(/^Every 2 weeks on Fri/);
  expect(describeRule(parseRule('FREQ=MONTHLY')!)).toBe('Monthly');
});

it('lists occurrences', () => {
  expect(occurrencesBetween(parseRule('FREQ=DAILY;INTERVAL=3')!, '2026-09-01', '2026-09-05', '2026-09-12')).toEqual(['2026-09-07', '2026-09-10']);
  // Every other week on Mon and Thu, from Mon 7 Sep.
  expect(occurrencesBetween(parseRule('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH')!, '2026-09-07', '2026-09-01', '2026-09-30')).toEqual([
    '2026-09-07', '2026-09-10', '2026-09-21', '2026-09-24',
  ]);
  // Weekly with no days repeats on the anchor's weekday.
  expect(occurrencesBetween(parseRule('FREQ=WEEKLY')!, '2026-09-26', '2026-09-01', '2026-10-10')).toEqual(['2026-09-26', '2026-10-03', '2026-10-10']);
  // Monthly on the 31st clamps to short months.
  expect(occurrencesBetween(parseRule('FREQ=MONTHLY')!, '2026-01-31', '2026-01-01', '2026-04-30')).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  expect(occurrencesBetween(parseRule('FREQ=YEARLY')!, '2024-02-29', '2025-01-01', '2028-12-31')).toEqual(['2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29']);
  expect(occurrencesBetween(parseRule('FREQ=DAILY;UNTIL=20260903')!, '2026-09-01', '2026-09-01', '2026-09-30')).toHaveLength(3);
});

it('finds the next occurrence', () => {
  expect(nextOccurrence(parseRule('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR')!, '2026-09-21', '2026-09-25')).toBe('2026-09-28');
  expect(nextOccurrence(parseRule('FREQ=MONTHLY;INTERVAL=6')!, '2026-01-15', '2026-01-15')).toBe('2026-07-15');
  expect(nextOccurrence(parseRule('FREQ=YEARLY;INTERVAL=2')!, '2026-03-01', '2026-03-01')).toBe('2028-03-01');
  expect(nextOccurrence(parseRule('FREQ=DAILY;UNTIL=20260902')!, '2026-09-01', '2026-09-02')).toBeNull();
});
