import { describe, it, expect } from 'vitest';
import { addDays, format } from 'date-fns';
import { getDueBucket } from './dueDate';

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
