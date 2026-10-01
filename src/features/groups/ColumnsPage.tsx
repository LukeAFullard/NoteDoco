import { useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Columns3, Plus, X } from 'lucide-react';
import { Link } from 'react-router';
import { Pane } from '@/app/Pane';
import { setCurrentGroup } from '@/app/ui';
import { toastWithUndo } from '@/app/undoActions';
import { IconButton } from '@/design/Button';
import { EmptyState } from '@/design/EmptyState';
import { db } from '@/data/db';
import { useGroups } from '@/data/hooks';
import { moveItemsWithUndo } from '@/data/actions';
import { createItem } from '@/data/repos/items';
import type { Group, Item } from '@/data/types';
import { compareOrder } from '@/lib/order';
import { readPref, writePref } from '@/lib/localPref';
import { ItemCard } from '@/features/items/ItemCard';
import { ItemDropZone } from '@/features/items/DropZone';
import { selectRange, toggleSelected, useSelection } from '@/features/items/selection';
import { openSticky } from '@/features/stickies/stickyDialog';

const INBOX = 'inbox';
const MAX_COLUMNS = 4;

function Column({ id, group, onRemove }: { id: string; group: Group | undefined; onRemove: () => void }) {
  const groupId = id === INBOX ? null : id;
  const items = useLiveQuery(
    async () =>
      (groupId ? await db.items.where('groupId').equals(groupId).toArray() : await db.items.filter((i) => i.groupId === null).toArray())
        .filter((i) => !i.deletedAt && !i.archived)
        .sort((a, b) => compareOrder(a.order, b.order)),
    [groupId],
  );
  const ids = useSelection((s) => s.ids);
  const name = group?.name ?? 'Inbox';
  const order = (items ?? []).map((i) => i.id);
  const onSelect = (item: Item, e: { shiftKey: boolean }) => (e.shiftKey ? selectRange(item.id, order) : toggleSelected(item.id));

  return (
    <section aria-label={name} className="flex w-[85vw] shrink-0 snap-start flex-col border-r border-border sm:w-auto sm:min-w-64 sm:flex-1">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
        {group && <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/10" style={{ background: `var(--sticky-${group.colour})` }} />}
        <Link to={groupId ? `/groups/${groupId}` : '/inbox'} className="min-w-0 flex-1 truncate font-medium hover:underline">
          {name}
        </Link>
        <span className="font-mono text-xs text-muted">{items?.length ?? ''}</span>
        <IconButton
          label={`Add a sticky to ${name}`}
          size="sm"
          onPress={async () => openSticky(await createItem({ kind: 'sticky', groupId }), true)}
        >
          <Plus size={15} />
        </IconButton>
        <IconButton label={`Remove the ${name} column`} size="sm" onPress={onRemove}>
          <X size={15} />
        </IconButton>
      </header>
      <ItemDropZone
        className="min-h-0 flex-1 overflow-y-auto p-2"
        onDropItems={async (dropped) => {
          const moving = dropped.filter((d) => !order.includes(d));
          if (moving.length) toastWithUndo(await moveItemsWithUndo(moving, groupId));
        }}
      >
        {items && !items.length && <p className="px-2 py-6 text-center text-sm text-muted">Nothing here. Drag items in from another column.</p>}
        <ul className="flex flex-col gap-1">
          {items?.map((item) => (
            <li key={item.id}>
              <ItemCard item={item} density="row" selected={ids.has(item.id)} selecting={ids.size > 0} onSelect={onSelect} href={`/items/${item.id}`} />
            </li>
          ))}
        </ul>
      </ItemDropZone>
    </section>
  );
}

/**
 * Groups side by side (GRP-11): two to four groups as columns of cards. Drag between columns
 * to move items (or use Move to… in each item's menu).
 */
export function ColumnsPage() {
  const [params, setParams] = useSearchParams();
  const groups = useGroups() ?? [];
  const byId = new Map(groups.map((g) => [g.id, g]));
  const fromUrl = params.get('groups');
  const chosen = (fromUrl !== null ? fromUrl.split(',').filter(Boolean) : readPref<string[]>('columns', [])).filter((id) => id === INBOX || byId.has(id) || !groups.length);
  const columns = chosen.length ? chosen : [INBOX, ...groups.slice(0, 2).map((g) => g.id)];
  useEffect(() => setCurrentGroup(null), []);

  const set = (next: string[]) => {
    writePref('columns', next);
    const p = new URLSearchParams(params);
    p.set('groups', next.join(','));
    setParams(p, { replace: true });
  };
  const available = [{ id: INBOX, name: 'Inbox' }, ...groups.filter((g) => !g.archived)].filter((g) => !columns.includes(g.id));

  return (
    <Pane
      title="Side by side"
      actions={
        columns.length < MAX_COLUMNS &&
        available.length > 0 && (
          <label className="flex items-center gap-2 text-sm">
            <span className="hidden text-muted sm:inline">Add a column</span>
            <select
              aria-label="Add a column"
              value=""
              onChange={(e) => e.target.value && set([...columns, e.target.value])}
              className="h-8 rounded-panel border border-border bg-surface px-2"
            >
              <option value="">Choose a group…</option>
              {available.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
        )
      }
    >
      {columns.length ? (
        <div className="flex h-full snap-x snap-mandatory overflow-x-auto">
          {columns.map((id) => (
            <Column key={id} id={id} group={byId.get(id)} onRemove={() => set(columns.filter((c) => c !== id))} />
          ))}
        </div>
      ) : (
        <EmptyState icon={<Columns3 size={32} />} title="Pick some groups" body="Choose groups with Add a column to compare them side by side, and drag items between them." />
      )}
    </Pane>
  );
}
