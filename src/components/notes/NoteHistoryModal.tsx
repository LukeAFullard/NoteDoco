import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Modal } from '../ui/Modal';
import { Panel } from '../ui/Panel';
import { Button } from '../ui/Button';
import { getNoteVersions } from '../../db';
import type { NoteVersion } from '../../types';

interface NoteHistoryModalProps {
  noteId: string;
  onClose: () => void;
  onRestore: (version: NoteVersion) => void;
}

export function NoteHistoryModal({ noteId, onClose, onRestore }: NoteHistoryModalProps) {
  const [versions, setVersions] = useState<NoteVersion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getNoteVersions(noteId).then((all) => {
      setVersions([...all].sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1)));
      setLoading(false);
    });
  }, [noteId]);

  return (
    <Modal onClose={onClose}>
      <Panel className="p-6 w-full max-w-md max-h-[80vh] flex flex-col">
        <h2 className="text-lg font-semibold text-graphite dark:text-stone mb-4">History</h2>
        {loading ? null : versions.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No earlier versions yet — checkpoints are saved automatically as you edit.
          </p>
        ) : (
          <div className="overflow-y-auto space-y-2">
            {versions.map((version) => (
              <div key={version.id} className="flex items-center justify-between gap-3 p-3 border border-graphite/10 dark:border-white/10 rounded-panel">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-graphite dark:text-stone truncate">{version.title || 'Untitled note'}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 tabular">{format(new Date(version.savedAt), 'MMM d, yyyy · h:mm a')}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (window.confirm('Restore this version? Your current content will be saved as a new checkpoint first.')) {
                      onRestore(version);
                    }
                  }}
                >
                  Restore
                </Button>
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end mt-4">
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
      </Panel>
    </Modal>
  );
}
