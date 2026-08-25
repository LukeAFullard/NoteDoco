import { describe, it, expect } from 'vitest';
import { shouldCreateSnapshot } from './noteHistory';

describe('shouldCreateSnapshot', () => {
  it('returns true when there is no prior snapshot', () => {
    expect(shouldCreateSnapshot(null)).toBe(true);
  });

  it('returns false when the interval has not elapsed', () => {
    const now = new Date('2026-01-01T00:10:00Z');
    const last = '2026-01-01T00:08:00Z';
    expect(shouldCreateSnapshot(last, now, 5 * 60 * 1000)).toBe(false);
  });

  it('returns true once the interval has elapsed', () => {
    const now = new Date('2026-01-01T00:13:01Z');
    const last = '2026-01-01T00:08:00Z';
    expect(shouldCreateSnapshot(last, now, 5 * 60 * 1000)).toBe(true);
  });
});
