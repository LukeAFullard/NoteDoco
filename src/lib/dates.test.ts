import { formatRelative } from './dates';

const now = new Date('2026-09-26T12:00:00');
it('formats recent times relatively', () => {
  expect(formatRelative('2026-09-26T11:59:40', now)).toBe('just now');
  expect(formatRelative('2026-09-26T11:50:00', now)).toMatch(/10 min/);
  expect(formatRelative('2026-09-25T09:00:00', now)).toMatch(/yesterday/i);
  expect(formatRelative('2026-08-01T09:00:00', now)).toMatch(/Aug/);
});
