import { useLiveQuery } from 'dexie-react-hooks';
import { RotateCcw, Trash2 } from 'lucide-react';
import { db } from '@/data/db';
import { restoreGroup } from '@/data/repos/groups';
import { Pane } from '@/app/Pane';
import { Button } from '@/design/Button';
import { EmptyState } from '@/design/EmptyState';
import { showToast } from '@/design/toast';

export function TrashPage() {
  const groups = useLiveQuery(async () => {
    const trashed = await db.groups.where('deletedAt').above('').toArray();
    // Only show top-most trashed groups; sub-groups come back with their parent.
    return trashed.filter((g) => !trashed.some((p) => p.id === g.parentId && p.deletedAt === g.deletedAt));
  }, []);

  return (
    <Pane title="Trash">
      <p className="px-4 pt-3 text-sm text-muted">Items stay here for 30 days, then they’re deleted for good.</p>
      {groups && groups.length > 0 ? (
        <ul className="mt-2 divide-y divide-border">
          {groups.map((g) => (
            <li key={g.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: `var(--sticky-${g.colour})` }} />
              <span className="flex-1">{g.name}</span>
              <Button
                size="sm"
                variant="ghost"
                onPress={async () => {
                  await restoreGroup(g.id);
                  showToast({ message: `Restored “${g.name}”` }, 3000);
                }}
              >
                <RotateCcw size={14} aria-hidden /> Restore
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={<Trash2 size={32} />} title="Trash is empty" body="Things you delete wait here for 30 days in case you change your mind." />
      )}
    </Pane>
  );
}
