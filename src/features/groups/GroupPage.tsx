import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Archive, ArchiveRestore, FolderInput, FolderOpen, FolderPlus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Menu as AriaMenu, Popover, SubmenuTrigger } from 'react-aria-components';
import { db } from '@/data/db';
import { updateGroup } from '@/data/repos/groups';
import { archiveGroupWithUndo, moveGroupWithUndo, moveItemsWithUndo, trashGroupWithUndo } from '@/data/actions';
import { ItemDropZone } from '@/features/items/DropZone';
import { showToast } from '@/design/toast';
import { useGroups, useItems } from '@/data/hooks';
import { Pane } from '@/app/Pane';
import { openNewGroup, setCurrentGroup } from '@/app/ui';
import { toastWithUndo } from '@/app/undoActions';
import { Menu, MenuItem } from '@/design/Menu';
import { IconButton } from '@/design/Button';
import { EmptyState } from '@/design/EmptyState';
import { Kbd } from '@/design/Kbd';
import { CollectionControls, ItemCollection, type CollectionPrefs } from '@/features/items/ItemCollection';
import { NewMenu } from '@/features/capture/NewMenu';
import { usePasteToCreate } from '@/features/capture/usePasteToCreate';
import { compareOrder } from '@/lib/order';
import { GroupEditDialog } from './GroupEditDialog';

export function GroupPage() {
  const { groupId = '' } = useParams();
  const navigate = useNavigate();
  const group = useLiveQuery(() => db.groups.get(groupId), [groupId]);
  const items = useItems(groupId);
  const children = useLiveQuery(
    async () => (await db.groups.where('parentId').equals(groupId).toArray()).filter((g) => !g.deletedAt).sort((a, b) => compareOrder(a.order, b.order)),
    [groupId],
  );
  const [editing, setEditing] = useState(false);
  const allGroups = useGroups() ?? [];
  useEffect(() => setCurrentGroup(groupId), [groupId]);
  usePasteToCreate(groupId);

  if (group === undefined) return null;
  if (!group || group.deletedAt) {
    return (
      <Pane title="Group not found">
        <EmptyState title="This group isn’t here" body="It may have been moved to the Trash." />
      </Pane>
    );
  }

  const view = group.viewPrefs.view === 'cards' ? 'cards' : 'list';
  const prefs: CollectionPrefs = { view, sort: group.viewPrefs.sort === 'due' ? 'manual' : group.viewPrefs.sort };

  return (
    <Pane
      title={
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 shrink-0 rounded-full border border-black/10" style={{ background: `var(--sticky-${group.colour})` }} />
          {group.icon && <span aria-hidden>{group.icon}</span>}
          <span className="truncate">{group.name}</span>
          {group.archived && <span className="rounded bg-surface-2 px-1.5 py-0.5 text-xs font-normal text-muted">Archived</span>}
        </span>
      }
      actions={
        <div className="flex items-center gap-2">
          <CollectionControls prefs={prefs} onChange={(p) => void updateGroup(group.id, { viewPrefs: { ...group.viewPrefs, ...p } })} />
          <NewMenu compact />
          <Menu label="Group actions" trigger={<IconButton label="Group actions"><MoreHorizontal size={18} /></IconButton>}>
            <MenuItem onAction={() => setEditing(true)}>
              <Pencil size={15} aria-hidden /> Edit name, icon and colour
            </MenuItem>
            <MenuItem onAction={() => openNewGroup(group.id)}>
              <FolderPlus size={15} aria-hidden /> New sub-group
            </MenuItem>
            <SubmenuTrigger>
              <MenuItem>
                <FolderInput size={15} aria-hidden /> Move group to…
              </MenuItem>
              <Popover className="max-h-[60vh] min-w-52 overflow-auto rounded-panel border border-border bg-surface p-1 shadow-lg outline-none">
                <AriaMenu aria-label="Move group to" className="outline-none">
                  <MenuItem onAction={async () => toastWithUndo(await moveGroupWithUndo(group.id, null))}>Top level</MenuItem>
                  {allGroups
                    .filter((g) => g.id !== group.id && g.id !== group.parentId)
                    .map((g) => (
                      <MenuItem
                        key={g.id}
                        onAction={async () => {
                          try {
                            toastWithUndo(await moveGroupWithUndo(group.id, g.id));
                          } catch (err) {
                            showToast({ message: err instanceof Error ? err.message : 'Couldn’t move the group', tone: 'danger' }, 4000);
                          }
                        }}
                      >
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: `var(--sticky-${g.colour})` }} />
                        {g.name}
                      </MenuItem>
                    ))}
                </AriaMenu>
              </Popover>
            </SubmenuTrigger>
            <MenuItem onAction={async () => toastWithUndo(await archiveGroupWithUndo(group.id, !group.archived))}>
              {group.archived ? <ArchiveRestore size={15} aria-hidden /> : <Archive size={15} aria-hidden />}
              {group.archived ? 'Unarchive group' : 'Archive group'}
            </MenuItem>
            <MenuItem
              danger
              onAction={async () => {
                toastWithUndo(await trashGroupWithUndo(group.id));
                navigate('/today');
              }}
            >
              <Trash2 size={15} aria-hidden /> Move to Trash
            </MenuItem>
          </Menu>
        </div>
      }
    >
      {children && children.length > 0 && (
        <nav aria-label="Sub-groups" className="flex flex-wrap gap-2 border-b border-border px-4 py-3">
          {children.map((c) => (
            <Link key={c.id} to={`/groups/${c.id}`} className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm hover:border-accent">
              <span className="h-2 w-2 rounded-full" style={{ background: `var(--sticky-${c.colour})` }} />
              {c.icon} {c.name}
            </Link>
          ))}
        </nav>
      )}
      {items && (
        // Items dragged here from another pane or the columns view move into this group (WS-2).
        <ItemDropZone
          className="min-h-[calc(100%-1px)]"
          onDropItems={async (ids) => {
            const moving = ids.filter((id) => !items.some((i) => i.id === id));
            if (moving.length) toastWithUndo(await moveItemsWithUndo(moving, group.id));
          }}
        >
          <ItemCollection
            items={items.filter((i) => !i.archived)}
            prefs={prefs}
            empty={
              <EmptyState
                icon={<FolderOpen size={32} />}
                title={`Nothing in ${group.name} yet`}
                body="Add a note or a sticky, or paste text or images here. Drag things from other groups onto this one in the sidebar."
                action={
                  <span className="flex gap-2 text-sm text-muted">
                    <Kbd>N</Kbd> note <Kbd>S</Kbd> sticky
                  </span>
                }
              />
            }
          />
        </ItemDropZone>
      )}
      {editing && <GroupEditDialog group={group} isOpen onClose={() => setEditing(false)} />}
    </Pane>
  );
}
