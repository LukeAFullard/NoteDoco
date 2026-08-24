import { describe, it, expect } from 'vitest';
import { addDays, addWeeks, format } from 'date-fns';
import { getDueBucket, getTimelineColumnIndex, getTimelineColumns } from './dueDate';

const iso = (offsetDays: number) => format(addDays(new Date(), offsetDays), 'yyyy-MM-dd');

describe('getDueBucket', () => {
  it('classifies a past date as overdue', () => {
    expect(getDueBucket(iso(-2))).toBe('overdue');
  });

  it('classifies today as today', () => {
    expect(getDueBucket(iso(0))).toBe('today');
  });

  it('classifies a date within the next 7 days as this-week', () => {
    expect(getDueBucket(iso(3))).toBe('this-week');
  });

  it('classifies a date more than 7 days out as later', () => {
    expect(getDueBucket(iso(10))).toBe('later');
  });
});

describe('getTimelineColumnIndex', () => {
  it('puts a date before this week in column 0 (Overdue)', () => {
    expect(getTimelineColumnIndex(iso(-10))).toBe(0);
  });

  it('puts today in column 1 (This Week)', () => {
    expect(getTimelineColumnIndex(iso(0))).toBe(1);
  });

  it('puts a date 5 weeks out in column 6 (Later)', () => {
    const now = new Date();
    const farOut = format(addWeeks(now, 8), 'yyyy-MM-dd');
    expect(getTimelineColumnIndex(farOut, now)).toBe(6);
  });
});

describe('getTimelineColumns', () => {
  it('returns 7 columns starting with Overdue and ending with Later', () => {
    const columns = getTimelineColumns();
    expect(columns).toHaveLength(7);
    expect(columns[0].label).toBe('Overdue');
    expect(columns[1].label).toBe('This Week');
    expect(columns[6].label).toBe('Later');
  });
});
