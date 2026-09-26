import { db } from '../db';
import { freshMeta, touched } from '../meta';
import type { Group, Id } from '../types';
import { compareOrder, orderBetween } from '@/lib/order';
import { nowIso } from '@/lib/ids';
import type { ColourKey } from '@/lib/palette';

export interface NewGroup {
  name: string;
  colour?: ColourKey;
  parentId?: Id | null;
  icon?: string | null;
}

const byOrder = (a: Group, b: Group) => compareOrder(a.order, b.order);

/** Live (not trashed) groups, in manual order. */
export async function listGroups(): Promise<Group[]> {
  const all = await db.groups.toArray();
  return all.filter((g) => !g.deletedAt).sort(byOrder);
}

async function siblings(parentId: Id | null): Promise<Group[]> {
  // parentId null isn't indexable, so root groups are filtered in memory.
  const all = parentId ? await db.groups.where('parentId').equals(parentId).toArray() : await db.groups.toArray();
  return all.filter((g) => g.parentId === parentId && !g.deletedAt).sort(byOrder);
}

export async function createGroup(input: NewGroup): Promise<Id> {
  const parentId = input.parentId ?? null;
  const sibs = await siblings(parentId);
  const group: Group = {
    ...freshMeta(),
    parentId,
    name: input.name.trim() || 'Untitled group',
    colour: input.colour ?? 'slate',
    icon: input.icon ?? null,
    order: orderBetween(sibs.at(-1)?.order ?? null, null),
    archived: false,
    boardId: null,
    viewPrefs: { view: 'list', sort: 'manual' },
  };
  await db.groups.add(group);
  return group.id;
}

export async function updateGroup(id: Id, patch: Partial<Pick<Group, 'name' | 'colour' | 'icon' | 'archived' | 'viewPrefs'>>) {
  await db.transaction('rw', db.groups, async () => {
    const g = await db.groups.get(id);
    if (!g) throw new Error(`Group ${id} not found`);
    await db.groups.put(touched(g, patch));
  });
}

/** Moves a group under `parentId`, placed before `beforeId` (or last when null). */
export async function moveGroup(id: Id, parentId: Id | null, beforeId: Id | null = null) {
  await db.transaction('rw', db.groups, async () => {
    const g = await db.groups.get(id);
    if (!g) throw new Error(`Group ${id} not found`);
    if (parentId && (await isDescendant(parentId, id))) throw new Error('A group can’t be moved inside itself');
    const sibs = (await siblings(parentId)).filter((s) => s.id !== id);
    const idx = beforeId ? sibs.findIndex((s) => s.id === beforeId) : sibs.length;
    const at = idx < 0 ? sibs.length : idx;
    const order = orderBetween(sibs[at - 1]?.order ?? null, sibs[at]?.order ?? null);
    await db.groups.put(touched(g, { parentId, order }));
  });
}

async function isDescendant(candidate: Id, ancestor: Id): Promise<boolean> {
  let cur = await db.groups.get(candidate);
  while (cur) {
    if (cur.id === ancestor) return true;
    cur = cur.parentId ? await db.groups.get(cur.parentId) : undefined;
  }
  return false;
}

async function descendantIds(id: Id): Promise<Id[]> {
  const out: Id[] = [];
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    out.push(cur);
    const kids = await db.groups.where('parentId').equals(cur).primaryKeys();
    stack.push(...kids);
  }
  return out;
}

/**
 * Trashes a group, its sub-groups and their items, all stamped with the same `deletedAt`.
 * Restoring brings back exactly the records trashed together (not ones trashed earlier).
 * Returns the stamp so callers can offer undo.
 */
export async function trashGroup(id: Id): Promise<string> {
  const stamp = nowIso();
  await db.transaction('rw', db.groups, db.items, async () => {
    const ids = await descendantIds(id);
    for (const gid of ids) {
      const g = await db.groups.get(gid);
      if (g && !g.deletedAt) await db.groups.put(touched(g, { deletedAt: stamp }, stamp));
      const items = await db.items.where('groupId').equals(gid).toArray();
      for (const it of items) if (!it.deletedAt) await db.items.put(touched(it, { deletedAt: stamp }, stamp));
    }
  });
  return stamp;
}

export async function restoreGroup(id: Id): Promise<void> {
  await db.transaction('rw', db.groups, db.items, async () => {
    const root = await db.groups.get(id);
    if (!root?.deletedAt) return;
    const stamp = root.deletedAt;
    for (const gid of await descendantIds(id)) {
      const g = await db.groups.get(gid);
      if (g?.deletedAt === stamp) await db.groups.put(touched(g, { deletedAt: null }));
      const items = await db.items.where('groupId').equals(gid).toArray();
      for (const it of items) if (it.deletedAt === stamp) await db.items.put(touched(it, { deletedAt: null }));
    }
    // If the parent is gone, restore to the top level rather than leaving an orphan.
    if (root.parentId) {
      const parent = await db.groups.get(root.parentId);
      if (!parent || parent.deletedAt) await db.groups.update(id, { parentId: null });
    }
  });
}

export interface GroupNode {
  group: Group;
  children: GroupNode[];
}

/** Builds the sidebar tree from a flat, ordered list. */
export function buildTree(groups: Group[]): GroupNode[] {
  const nodes = new Map(groups.map((g) => [g.id, { group: g, children: [] as GroupNode[] }]));
  const roots: GroupNode[] = [];
  for (const g of [...groups].sort(byOrder)) {
    const node = nodes.get(g.id)!;
    const parent = g.parentId ? nodes.get(g.parentId) : undefined;
    (parent ? parent.children : roots).push(node);
  }
  return roots;
}
