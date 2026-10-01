import { db } from '@/data/db';
import { createItem } from '@/data/repos/items';
import type { Id } from '@/data/types';
import { recordUndo } from '@/data/undo';
import { trashItems, restoreItems } from '@/data/repos/items';

/** Turns a sticky into a full note in the same group. The sticky stays, linked to the note. */
export async function promoteToNote(stickyId: Id): Promise<Id> {
  const [item, body] = await Promise.all([db.items.get(stickyId), db.stickyBodies.get(stickyId)]);
  if (!item || !body) throw new Error('Sticky not found');
  const noteId = await createItem({ kind: 'note', groupId: item.groupId, text: body.text, colour: item.colour });
  await db.links.put({ fromItemId: stickyId, toItemId: noteId, kind: 'embed' });
  recordUndo({ label: 'Made a note', undo: () => trashItems([noteId]), redo: () => restoreItems([noteId]) });
  return noteId;
}

/** Merges several stickies into one note: each sticky becomes a bullet (checklists stay checklists). */
export async function mergeIntoNote(stickyIds: Id[]): Promise<Id> {
  const items = (await db.items.bulkGet(stickyIds)).filter((i) => i?.kind === 'sticky');
  const bodies = await db.stickyBodies.bulkGet(stickyIds);
  const lines: string[] = [];
  for (const b of bodies) {
    if (!b?.text.trim()) continue;
    const [first, ...rest] = b.text.trim().split('\n');
    lines.push(/^\s*[-*+]\s/.test(first!) ? first! : `- ${first}`, ...rest.map((l) => (l.trim() ? `  ${l}` : l)));
  }
  const noteId = await createItem({ kind: 'note', groupId: items[0]?.groupId ?? null, text: `Merged stickies\n\n${lines.join('\n')}` });
  for (const id of stickyIds) await db.links.put({ fromItemId: id, toItemId: noteId, kind: 'embed' });
  recordUndo({ label: 'Merged into a note', undo: () => trashItems([noteId]), redo: () => restoreItems([noteId]) });
  return noteId;
}

/** The note a sticky was promoted to, if any (and it isn't trashed). */
export async function linkedNote(stickyId: Id): Promise<Id | null> {
  const links = await db.links.where('fromItemId').equals(stickyId).toArray();
  for (const l of links) {
    const n = await db.items.get(l.toItemId);
    if (n && !n.deletedAt) return n.id;
  }
  return null;
}
