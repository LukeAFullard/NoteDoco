import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { RotateCcw, Trash2, X } from 'lucide-react';
import { db } from '@/data/db';
import { restoreGroup } from '@/data/repos/groups';
import { deleteItemsForever, emptyTrash, listTrash, restoreItems, TRASH_RETENTION_DAYS } from '@/data/repos/items';
import { Pane } from '@/app/Pane';
import { Button, IconButton } from '@/design/Button';
import { Dialog } from '@/design/Dialog';
import { EmptyState } from '@/design/EmptyState';
import { showToast } from '@/design/toast';
import { KIND_ICONS, itemTitle } from '@/features/items/kinds';
import { formatRelative } from '@/lib/dates';

const daysLeft = (deletedAt: string) =>
  Math.max(0, TRASH_RETENTION_DAYS - Math.floor((Date.now() - new Date(deletedAt).getTime()) / 86_400_000));

/** Deleting for good is the one thing NoteDoco asks about first (plan §3 rule 3). */
function ConfirmDialog({ title, body, action, onConfirm, onClose }: { title: string; body: string; action: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <Dialog isOpen onOpenChange={(o) => !o && onClose()} title={title}>
      <p className="px-5 py-3 text-sm text-muted">{body}</p>
      <div className="flex justify-end gap-2 p-5 pt-2">
        <Button variant="ghost" onPress={onClose} autoFocus>
          Cancel
        </Button>
        <Button
          variant="danger"
          className="!bg-danger !text-bg"
          onPress={() => {
            onConfirm();
            onClose();
          }}
        >
          {action}
        </Button>
      </div>
    </Dialog>
  );
}

export function TrashPage() {
  const items = useLiveQuery(listTrash, []);
  const groups = useLiveQuery(async () => {
    const trashed = await db.groups.where('deletedAt').above('').toArray();
    // Only top-most trashed groups; sub-groups come back with their parent.
    return trashed.filter((g) => !trashed.some((p) => p.id === g.parentId && p.deletedAt === g.deletedAt));
  }, []);
  const [confirm, setConfirm] = useState<{ ids: string[] | 'all'; label: string } | null>(null);
  const empty = items && groups && !items.length && !groups.length;

  return (
    <Pane
      title="Trash"
      actions={
        !empty && (
          <Button size="sm" variant="danger" onPress={() => setConfirm({ ids: 'all', label: 'everything in the Trash' })}>
            <Trash2 size={14} aria-hidden /> Empty Trash
          </Button>
        )
      }
    >
      <p className="px-4 pt-3 text-sm text-muted">Things stay here for {TRASH_RETENTION_DAYS} days, then they’re deleted for good.</p>
      {empty ? (
        <EmptyState icon={<Trash2 size={32} />} title="Trash is empty" body="Things you delete wait here for 30 days in case you change your mind." />
      ) : (
        <ul className="mt-2 divide-y divide-border">
          {groups?.map((g) => (
            <li key={g.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: `var(--sticky-${g.colour})` }} />
              <span className="flex-1">
                {g.name} <span className="text-muted">· group with its contents · {daysLeft(g.deletedAt!)} days left</span>
              </span>
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
          {items
            ?.filter((i) => !groups?.some((g) => g.deletedAt === i.deletedAt && i.groupId !== null))
            .map((i) => {
              const Icon = KIND_ICONS[i.kind];
              return (
                <li key={i.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <Icon size={16} className="text-muted" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">
                    {itemTitle(i.title, i.kind)} <span className="text-muted">· deleted {formatRelative(i.deletedAt!)} · {daysLeft(i.deletedAt!)} days left</span>
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onPress={async () => {
                      await restoreItems([i.id]);
                      showToast({ message: `Restored “${itemTitle(i.title, i.kind)}”` }, 3000);
                    }}
                  >
                    <RotateCcw size={14} aria-hidden /> Restore
                  </Button>
                  <IconButton label={`Delete “${itemTitle(i.title, i.kind)}” forever`} size="sm" variant="danger" onPress={() => setConfirm({ ids: [i.id], label: `“${itemTitle(i.title, i.kind)}”` })}>
                    <X size={16} />
                  </IconButton>
                </li>
              );
            })}
        </ul>
      )}
      {confirm && (
        <ConfirmDialog
          title="Delete forever?"
          body={`This permanently deletes ${confirm.label}, including its history and attachments. It can’t be undone.`}
          action="Delete forever"
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            if (confirm.ids === 'all') await emptyTrash();
            else await deleteItemsForever(confirm.ids);
            showToast({ message: 'Deleted for good' }, 3000);
          }}
        />
      )}
    </Pane>
  );
}
