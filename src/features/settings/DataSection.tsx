import { useRef, useState } from 'react';
import { Download, FolderUp, FileUp, Upload } from 'lucide-react';
import { Button } from '@/design/Button';
import { Dialog } from '@/design/Dialog';
import { Switch } from '@/design/Switch';
import { showToast } from '@/design/toast';
import { useSetting, setSetting } from '@/data/repos/settings';
import { formatDateTime, formatRelative } from '@/lib/dates';
import type { MigrationReport } from '@/migration/v1';
import { DEFAULT_REMINDER, type BackupReminderSettings } from '@/backup/reminder';


function RestoreDialog({ file, onClose }: { file: File; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const restore = async (mode: 'replace' | 'merge') => {
    setBusy(true);
    setError(null);
    try {
      const { readBackup, restoreBackup } = await import('@/backup/backup');
      const backup = await readBackup(file);
      const r = await restoreBackup(backup, mode);
      showToast({ message: mode === 'replace' ? 'Backup restored.' : `Merged: ${r.added} added, ${r.updated} updated.` }, 6000);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That backup couldn’t be read.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog isOpen onOpenChange={(o) => !o && onClose()} title="Restore from backup">
      <div className="flex flex-col gap-3 p-5 text-sm">
        <p>
          <strong>{file.name}</strong>
        </p>
        <div className="rounded-panel border border-border p-3">
          <p className="font-medium">Merge with what’s here</p>
          <p className="mt-1 text-muted">Adds anything missing. Where both have the same note, the most recently edited one is kept.</p>
          <Button className="mt-2" size="sm" variant="primary" isDisabled={busy} onPress={() => void restore('merge')}>
            Merge
          </Button>
        </div>
        <div className="rounded-panel border border-danger/40 p-3">
          <p className="font-medium">Replace everything</p>
          <p className="mt-1 text-muted">Deletes everything in NoteDoco on this device and replaces it with the backup. This can’t be undone, so back up first if you’re not sure.</p>
          <Button className="mt-2 !bg-danger !text-bg" size="sm" variant="danger" isDisabled={busy} onPress={() => void restore('replace')}>
            Replace everything
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end">
          <Button variant="ghost" onPress={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/** Settings → Data: backup, restore, import, reminders, and what came over from v1. */
export function DataSection() {
  const lastBackupAt = useSetting<string | null>('lastBackupAt', null);
  const reminder = useSetting<BackupReminderSettings>('backupReminder', DEFAULT_REMINDER);
  const migration = useSetting<MigrationReport | null>('migration:v1', null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const backupInput = useRef<HTMLInputElement>(null);
  const filesInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  const backUp = async () => {
    setBusy(true);
    try {
      const { createBackup, backupFileName, download } = await import('@/backup/backup');
      download(await createBackup(__APP_VERSION__), backupFileName());
      showToast({ message: 'Backup saved to your downloads.' }, 4000);
    } finally {
      setBusy(false);
    }
  };

  /** Takes a copy of the files: the input's FileList is live and is emptied when the input resets. */
  const importFiles = async (files: File[]) => {
    if (!files.length) return;
    const { importTextFiles } = await import('@/backup/markdown');
    const n = await importTextFiles(files, null);
    showToast({ message: n ? `Imported ${n} note${n === 1 ? '' : 's'}.` : 'No Markdown or text files found.' }, 5000);
  };

  return (
    <div className="space-y-5 text-sm">
      <div>
        <p className="font-medium">Backups</p>
        <p className="mt-1 text-muted">
          A backup is one .zip file with all your notes, stickies, groups, history and attachments.{' '}
          {lastBackupAt ? (
            <>
              Last backup: <span title={formatDateTime(lastBackupAt)}>{formatRelative(lastBackupAt)}</span>.
            </>
          ) : (
            'You haven’t made a backup yet.'
          )}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" variant="primary" isDisabled={busy} onPress={() => void backUp()}>
            <Download size={14} aria-hidden /> Back up now
          </Button>
          <Button size="sm" onPress={() => backupInput.current?.click()}>
            <Upload size={14} aria-hidden /> Restore from backup…
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Switch isSelected={reminder.enabled} onChange={(enabled) => void setSetting('backupReminder', { ...reminder, enabled })}>
            Remind me to back up every
          </Switch>
          <select
            aria-label="Backup reminder interval"
            value={reminder.days}
            onChange={(e) => void setSetting('backupReminder', { ...reminder, days: Number(e.target.value) })}
            className="h-8 rounded-panel border border-border bg-surface px-2"
          >
            {[7, 14, 30].map((d) => (
              <option key={d} value={d}>
                {d} days
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <p className="font-medium">Import</p>
        <p className="mt-1 text-muted">Markdown (.md) and text (.txt) files become notes. Pick a folder to keep its structure: each folder becomes a group.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" onPress={() => filesInput.current?.click()}>
            <FileUp size={14} aria-hidden /> Import files…
          </Button>
          <Button size="sm" onPress={() => folderInput.current?.click()}>
            <FolderUp size={14} aria-hidden /> Import a folder…
          </Button>
        </div>
      </div>
      {migration?.found && (
        <p className="text-muted">
          Brought over from the previous version of NoteDoco: {migration.notes} notes, {migration.groups} groups, {migration.attachments} attachments (last checked{' '}
          {formatRelative(migration.at)}). The original copy on this device was never changed.
        </p>
      )}
      <input ref={backupInput} type="file" accept=".zip,application/zip" hidden onChange={(e) => { setRestoreFile(e.target.files?.[0] ?? null); e.target.value = ''; }} />
      <input ref={filesInput} type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" multiple hidden onChange={(e) => { void importFiles([...(e.target.files ?? [])]); e.target.value = ''; }} />
      <input
        ref={(el) => {
          folderInput.current = el;
          el?.setAttribute('webkitdirectory', '');
        }}
        type="file"
        hidden
        onChange={(e) => {
          void importFiles([...(e.target.files ?? [])]);
          e.target.value = '';
        }}
      />
      {restoreFile && <RestoreDialog file={restoreFile} onClose={() => setRestoreFile(null)} />}
    </div>
  );
}
