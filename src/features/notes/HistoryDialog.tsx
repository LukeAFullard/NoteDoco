import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { History } from 'lucide-react';
import { db } from '@/data/db';
import { decodeVersion, listVersions, restoreVersion } from '@/data/repos/versions';
import { Dialog } from '@/design/Dialog';
import { Button } from '@/design/Button';
import { Switch } from '@/design/Switch';
import { EmptyState } from '@/design/EmptyState';
import { toastWithUndo } from '@/app/undoActions';
import { formatDateTime, formatRelative } from '@/lib/dates';
import { diffLines } from '@/lib/diff';
import { cn } from '@/design/cn';

/**
 * Time travel for a note (SAFE-5): scrub through saved versions, compare with now, restore.
 * Restoring saves the current text first and can be undone.
 */
export function HistoryDialog({ itemId, onClose, onRestored }: { itemId: string; onClose: () => void; onRestored: () => void }) {
  const versions = useLiveQuery(() => listVersions(itemId), [itemId]);
  const current = useLiveQuery(() => db.noteBodies.get(itemId), [itemId]);
  const [index, setIndex] = useState(0);
  const [compare, setCompare] = useState(true);

  const v = versions?.[index];
  const content = v ? decodeVersion(v) : null;
  return (
    <Dialog isOpen onOpenChange={(o) => !o && onClose()} title="Version history" className="sm:!max-w-3xl">
      {!versions ? null : versions.length === 0 ? (
        <EmptyState icon={<History size={28} />} title="No earlier versions yet" body="NoteDoco saves a version every few minutes while you edit, and whenever you leave the note." />
      ) : (
        <div className="flex flex-col gap-3 p-5">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-muted">Older</span>
            <input
              type="range"
              min={0}
              max={versions.length - 1}
              value={versions.length - 1 - index}
              onChange={(e) => setIndex(versions.length - 1 - Number(e.target.value))}
              aria-label="Choose a version"
              aria-valuetext={v ? formatDateTime(v.createdAt) : ''}
              className="flex-1 accent-[var(--color-accent-fill)]"
            />
            <span className="font-mono text-xs text-muted">Newer</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>
              <strong>{v && formatDateTime(v.createdAt)}</strong>{' '}
              <span className="text-muted">
                ({v && formatRelative(v.createdAt)} · version {versions.length - index} of {versions.length})
              </span>
            </span>
            <Switch isSelected={compare} onChange={setCompare}>
              Compare with now
            </Switch>
          </div>
          <div className="max-h-[50vh] overflow-auto rounded-panel border border-border bg-bg p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
            {content &&
              (compare && current
                ? diffLines(content.text, current.text).map((d, i) => (
                    <div
                      key={i}
                      className={cn(d.type === 'added' && 'bg-success/15 text-success', d.type === 'removed' && 'bg-danger/10 text-danger line-through')}
                    >
                      <span aria-hidden className="mr-2 select-none opacity-60">
                        {d.type === 'added' ? '+' : d.type === 'removed' ? '−' : ' '}
                      </span>
                      {d.text || ' '}
                    </div>
                  ))
                : content.text)}
          </div>
          {compare && <p className="text-xs text-muted">Green lines were added since this version; red lines have been removed since.</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onPress={onClose}>
              Close
            </Button>
            <Button
              variant="primary"
              isDisabled={!v || content?.text === current?.text}
              onPress={async () => {
                await restoreVersion(v!.id);
                toastWithUndo('Restored an earlier version');
                onRestored();
              }}
            >
              Restore this version
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
