import { recordUndo } from './undo';
import { createItem, duplicateItem, moveItem, restoreItems, trashItems, updateItem } from './repos/items';
import { moveGroup, restoreGroup, trashGroup, updateGroup } from './repos/groups';
import { db } from './db';
import { touched } from './meta';
import type { Id, Item } from './types';
import type { ColourKey } from '@/lib/palette';

/**
 * User-facing actions: the repository call plus an undo entry. Each returns the toast message,
 * so the caller can show it with an Undo button.
 */

const plural = (n: number, one: string, many: string) => (n === 1 ? one : `${n} ${many}`);

export async function trashItemsWithUndo(ids: Id[]): Promise<string> {
  await trashItems(ids);
  const label = ids.length === 1 ? 'Moved to Trash' : `Moved ${ids.length} items to Trash`;
  recordUndo({ label, undo: () => restoreItems(ids), redo: () => trashItems(ids) });
  return label;
}

/** Moves items to a group (null = Inbox); undo puts each back exactly where it was. */
export async function moveItemsWithUndo(ids: Id[], groupId: Id | null): Promise<string> {
  const before = (await db.items.bulkGet(ids)).filter((i): i is Item => !!i);
  for (const id of ids) await moveItem(id, groupId);
  const target = groupId ? (await db.groups.get(groupId))?.name ?? 'group' : 'Inbox';
  const label = `Moved ${plural(ids.length, 'item', 'items')} to ${target}`;
  recordUndo({
    label,
    undo: async () => {
      for (const b of before) {
        const now = await db.items.get(b.id);
        if (now) await db.items.put(touched(now, { groupId: b.groupId, order: b.order }));
      }
    },
    redo: async () => {
      for (const id of ids) await moveItem(id, groupId);
    },
  });
  return label;
}

/** Kept for existing callers: single-item move. */
export const moveItemWithUndo = (id: Id, groupId: Id | null) => moveItemsWithUndo([id], groupId);

async function setFieldWithUndo<K extends 'pinned' | 'colour' | 'archived'>(ids: Id[], field: K, value: Item[K], label: string) {
  const before = (await db.items.bulkGet(ids)).filter((i): i is Item => !!i).map((i) => [i.id, i[field]] as const);
  for (const id of ids) await updateItem(id, { [field]: value } as Partial<Item>);
  recordUndo({
    label,
    undo: async () => {
      for (const [id, v] of before) await updateItem(id, { [field]: v } as Partial<Item>);
    },
    redo: async () => {
      for (const id of ids) await updateItem(id, { [field]: value } as Partial<Item>);
    },
  });
  return label;
}

export const setPinnedWithUndo = (ids: Id[], pinned: boolean) =>
  setFieldWithUndo(ids, 'pinned', pinned, pinned ? `Pinned ${plural(ids.length, 'item', 'items')}` : 'Unpinned');

export const setColourWithUndo = (ids: Id[], colour: ColourKey | null) => setFieldWithUndo(ids, 'colour', colour, 'Colour changed');

export const setArchivedWithUndo = (ids: Id[], archived: boolean) =>
  setFieldWithUndo(ids, 'archived', archived, archived ? `Archived ${plural(ids.length, 'item', 'items')}` : 'Unarchived');

export async function duplicateWithUndo(id: Id): Promise<{ id: Id; label: string }> {
  const copy = await duplicateItem(id);
  recordUndo({ label: 'Duplicated', undo: () => trashItems([copy]), redo: () => restoreItems([copy]) });
  return { id: copy, label: 'Duplicated' };
}

export async function trashGroupWithUndo(id: Id): Promise<string> {
  await trashGroup(id);
  recordUndo({ label: 'Group moved to Trash', undo: () => restoreGroup(id), redo: async () => void (await trashGroup(id)) });
  return 'Group moved to Trash';
}

export async function archiveGroupWithUndo(id: Id, archived: boolean): Promise<string> {
  await updateGroup(id, { archived });
  const label = archived ? 'Group archived' : 'Group unarchived';
  recordUndo({ label, undo: () => updateGroup(id, { archived: !archived }), redo: () => updateGroup(id, { archived }) });
  return label;
}

export { createItem };

/** Moves a group under `parentId` (null = top level), before `beforeId` or last; undoable. */
export async function moveGroupWithUndo(id: Id, parentId: Id | null, beforeId: Id | null = null): Promise<string> {
  const before = await db.groups.get(id);
  if (!before) throw new Error(`Group ${id} not found`);
  await moveGroup(id, parentId, beforeId);
  const label = 'Group moved';
  recordUndo({
    label,
    undo: async () => {
      const now = await db.groups.get(id);
      if (now) await db.groups.put(touched(now, { parentId: before.parentId, order: before.order }));
    },
    redo: () => moveGroup(id, parentId, beforeId),
  });
  return label;
}
