export interface BackupReminderSettings {
  enabled: boolean;
  days: number;
}
export const DEFAULT_REMINDER: BackupReminderSettings = { enabled: true, days: 14 };

const DAY = 86_400_000;

/**
 * Whether to nudge for a backup: only once there's something worth keeping (3+ items), the
 * last backup (or the first item, if never backed up) is older than the interval, and the
 * user hasn't said "later" recently.
 */
export function shouldRemind(args: {
  settings: BackupReminderSettings;
  itemCount: number;
  firstItemAt: string | null;
  lastBackupAt: string | null;
  snoozedUntil: string | null;
  now?: Date;
}): boolean {
  const { settings, itemCount, firstItemAt, lastBackupAt, snoozedUntil, now = new Date() } = args;
  if (!settings.enabled || itemCount < 3) return false;
  if (snoozedUntil && new Date(snoozedUntil) > now) return false;
  const since = lastBackupAt ?? firstItemAt;
  if (!since) return false;
  return now.getTime() - new Date(since).getTime() >= settings.days * DAY;
}
