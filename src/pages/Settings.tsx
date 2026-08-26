import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { format } from 'date-fns';
import { Download, Upload } from 'lucide-react';
import { getSettings } from '../db';
import { downloadBackup, parseBackupFile, importBackup } from '../utils/backup';
import { Panel } from '../components/ui/Panel';
import { Button } from '../components/ui/Button';
import type { AppSettings } from '../types';

export function Settings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  const handleExport = async () => {
    await downloadBackup();
    setSettings(await getSettings());
  };

  const handleFileSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    setImportMessage(null);
    try {
      const text = await file.text();
      const data = parseBackupFile(text);
      const result = await importBackup(data);
      setImportMessage(
        `Imported ${result.projectsImported} project(s), ${result.notesImported} note(s), and ${result.versionsImported} history checkpoint(s).`
      );
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Could not import this file.');
    } finally {
      e.target.value = '';
    }
  };

  if (!settings) return null;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-graphite dark:text-stone mb-6">Settings</h1>

      <Panel className="p-6">
        <h2 className="text-lg font-semibold text-graphite dark:text-stone mb-1">Data</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          {settings.lastBackupDate
            ? `Last backup: ${format(new Date(settings.lastBackupDate), "MMM d, yyyy 'at' h:mm a")}`
            : 'You have never backed up your data.'}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" size="sm" onClick={handleExport} className="gap-2">
            <Download size={14} /> Export All Data
          </Button>
          <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-2">
            <Upload size={14} /> Import Data
          </Button>
          <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleFileSelected} />
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
