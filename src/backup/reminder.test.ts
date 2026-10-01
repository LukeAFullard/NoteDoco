import { DEFAULT_REMINDER, shouldRemind } from './reminder';

const now = new Date('2026-09-26T12:00:00Z');
const base = { settings: DEFAULT_REMINDER, itemCount: 10, firstItemAt: '2026-08-01T00:00:00Z', lastBackupAt: null, snoozedUntil: null, now };

it('reminds when there is something to lose and no recent backup', () => {
  expect(shouldRemind(base)).toBe(true);
  expect(shouldRemind({ ...base, lastBackupAt: '2026-09-20T00:00:00Z' })).toBe(false);
  expect(shouldRemind({ ...base, lastBackupAt: '2026-09-01T00:00:00Z' })).toBe(true);
});

it('stays quiet for new users, when snoozed, or when turned off', () => {
  expect(shouldRemind({ ...base, itemCount: 2 })).toBe(false);
  expect(shouldRemind({ ...base, firstItemAt: '2026-09-20T00:00:00Z' })).toBe(false);
  expect(shouldRemind({ ...base, snoozedUntil: '2026-09-28T00:00:00Z' })).toBe(false);
  expect(shouldRemind({ ...base, settings: { enabled: false, days: 14 } })).toBe(false);
});
