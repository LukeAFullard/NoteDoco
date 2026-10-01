import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Archive, X } from 'lucide-react';
import { db } from '@/data/db';
import { useSetting } from '@/data/repos/settings';
import { DEFAULT_REMINDER, shouldRemind, type BackupReminderSettings } from '@/backup/reminder';
import { Button } from '@/design/Button';
import { showToast } from '@/design/toast';
import { readPref, writePref } from '@/lib/localPref';

/** A gentle nudge to back up (SAFE-6); "Later" snoozes it for three days. */
export function BackupReminder() {
  const settings = useSetting<BackupReminderSettings>('backupReminder', DEFAULT_REMINDER);
  const lastBackupAt = useSetting<string | null>('lastBackupAt', null);
  const stats = useLiveQuery(async () => ({ count: await db.items.count(), first: (await db.items.orderBy('createdAt').first())?.createdAt ?? null }), []);
  const [snoozedUntil, setSnoozedUntil] = useState(() => readPref<string | null>('backupSnoozedUntil', null));
  if (!stats || !shouldRemind({ settings, itemCount: stats.count, firstItemAt: stats.first, lastBackupAt, snoozedUntil })) return null;

  const snooze = () => {
    const until = new Date(Date.now() + 3 * 86_400_000).toISOString();
    writePref('backupSnoozedUntil', until);
    setSnoozedUntil(until);
  };
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border bg-accent-soft px-4 py-2 text-sm">
      <Archive size={16} aria-hidden className="text-accent" />
      <span className="flex-1">
        {lastBackupAt ? 'It’s been a while since your last backup.' : 'You haven’t backed up yet.'} Your notes only live on this device.
      </span>
      <Button
        size="sm"
        variant="primary"
        onPress={async () => {
          const { createBackup, backupFileName, download } = await import('@/backup/backup');
          download(await createBackup(__APP_VERSION__), backupFileName());
          showToast({ message: 'Backup saved to your downloads.' }, 4000);
        }}
      >
        Back up now
      </Button>
      <button type="button" onClick={snooze} className="flex items-center gap-1 text-muted hover:text-text" aria-label="Remind me later">
        Later <X size={14} aria-hidden />
      </button>
    </div>
  );
}
