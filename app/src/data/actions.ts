import { recordUndo } from './undo';
import { moveItem, restoreItems, trashItems } from './repos/items';
import { restoreGroup, trashGroup } from './repos/groups';
import { db } from './db';
import { touched } from './meta';
import type { Id } from './types';

/** User-facing actions: the repository call plus an undo entry. Returns the toast label. */

export async function trashItemsWithUndo(ids: Id[]): Promise<string> {
  await trashItems(ids);
  const label = ids.length === 1 ? 'Moved to Trash' : `Moved ${ids.length} items to Trash`;
  recordUndo({ label, undo: () => restoreItems(ids), redo: () => trashItems(ids) });
  return label;
}

export async function moveItemWithUndo(id: Id, groupId: Id | null): Promise<string> {
  const before = await db.items.get(id);
  if (!before) throw new Error(`Item ${id} not found`);
  await moveItem(id, groupId);
  recordUndo({
    label: 'Moved',
    // Restore the exact previous position, not just the group.
    undo: async () => {
      const now = await db.items.get(id);
      if (now) await db.items.put(touched(now, { groupId: before.groupId, order: before.order }));
    },
    redo: () => moveItem(id, groupId),
  });
  return 'Moved';
}

export async function trashGroupWithUndo(id: Id): Promise<string> {
  await trashGroup(id);
  recordUndo({ label: 'Group moved to Trash', undo: () => restoreGroup(id), redo: async () => void (await trashGroup(id)) });
  return 'Group moved to Trash';
}
