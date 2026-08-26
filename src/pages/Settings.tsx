import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { format } from 'date-fns';
import { Download, Upload, HardDrive, Paperclip } from 'lucide-react';
import { getSettings, getAllAttachments } from '../db';
import { downloadBackup, readAndImportBackupFile } from '../utils/backup';
import { getStorageEstimate, formatBytes, type StorageEstimateResult } from '../utils/attachments';
import { Panel } from '../components/ui/Panel';
import { Button } from '../components/ui/Button';
import type { AppSettings, Attachment } from '../types';

export function Settings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [storageEstimate, setStorageEstimate] = useState<StorageEstimateResult | null>(null);
  const [includeAttachments, setIncludeAttachments] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshData = async () => {
    const [stg, atts, est] = await Promise.all([
      getSettings(),
      getAllAttachments(),
      getStorageEstimate(),
    ]);
    setSettings(stg);
    setAttachments(atts);
    setStorageEstimate(est);
  };

  useEffect(() => {
    refreshData();
  }, []);

  const handleExport = async () => {
    await downloadBackup({ includeAttachments });
    await refreshData();
  };

  const handleFileSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    setImportMessage(null);
    try {
      const result = await readAndImportBackupFile(file);
      const attText = result.attachmentsImported > 0 ? `, and ${result.attachmentsImported} file attachment(s)` : '';
      setImportMessage(
        `Imported ${result.projectsImported} project(s), ${result.notesImported} note(s), ${result.versionsImported} history checkpoint(s)${attText}.`
      );
      await refreshData();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Could not import this file.');
    } finally {
      e.target.value = '';
    }
  };

  if (!settings) return null;

  const totalAttachmentBytes = attachments.reduce((sum, a) => sum + a.size, 0);

  let storagePercentage = 0;
  if (storageEstimate?.usage != null && storageEstimate?.quota != null && storageEstimate.quota > 0) {
    storagePercentage = Math.min(100, (storageEstimate.usage / storageEstimate.quota) * 100);
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-graphite dark:text-stone mb-6">Settings</h1>

      <Panel className="p-6">
        <h2 className="text-lg font-semibold text-graphite dark:text-stone mb-1 flex items-center gap-2">
          <HardDrive size={20} /> Storage
        </h2>
        <div className="space-y-4 mt-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
              <Paperclip size={16} /> Attached files ({attachments.length})
            </span>
            <span className="font-mono text-graphite dark:text-stone font-medium">
              {formatBytes(totalAttachmentBytes)}
            </span>
          </div>

          <div>
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>Browser origin storage</span>
              {storageEstimate?.usage != null && storageEstimate?.quota != null ? (
                <span className="font-mono">
                  {formatBytes(storageEstimate.usage)} / {formatBytes(storageEstimate.quota)}
                </span>
              ) : (
                <span>Storage estimate unavailable</span>
              )}
            </div>
            {storageEstimate?.usage != null && storageEstimate?.quota != null ? (
              <div className="w-full h-2 rounded-full bg-graphite/10 dark:bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-signal transition-all"
                  style={{ width: `${Math.max(1, storagePercentage)}%` }}
                />
              </div>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400 italic">Storage estimate unavailable</p>
            )}
          </div>
        </div>
      </Panel>

      <Panel className="p-6">
        <h2 className="text-lg font-semibold text-graphite dark:text-stone mb-1">Data</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          {settings.lastBackupDate
            ? `Last backup: ${format(new Date(settings.lastBackupDate), "MMM d, yyyy 'at' h:mm a")}`
            : 'You have never backed up your data.'}
        </p>

        <div className="mb-4">
          <label className="inline-flex items-center gap-2 text-sm text-graphite dark:text-stone cursor-pointer">
            <input
              type="checkbox"
              checked={includeAttachments}
              onChange={(e) => setIncludeAttachments(e.target.checked)}
              className="rounded border-graphite/20 dark:border-white/20 text-signal focus:ring-signal"
            />
            Include attached files
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="primary" size="sm" onClick={handleExport} className="gap-2">
            <Download size={14} /> Export All Data
          </Button>
          <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-2">
            <Upload size={14} /> Import Data
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.zip,application/json,application/zip"
            className="hidden"
            onChange={handleFileSelected}
          />
        </div>

        {importMessage && <p className="text-sm text-verdigris mt-3">{importMessage}</p>}
        {importError && <p className="text-sm text-rust mt-3">{importError}</p>}

        <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
          Importing adds these items to your existing data. Anything with a matching ID is overwritten — nothing is deleted.
        </p>
      </Panel>
    </div>
  );
}
