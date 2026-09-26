import { createItem } from '@/data/repos/items';
import { db } from '@/data/db';
import { nextColour, type ColourKey } from '@/lib/palette';
import { maybeRequestPersistence } from '@/app/durability';
import { useUi } from '@/app/ui';
import type { Id } from '@/data/types';

/** Remembers the last sticky colour so a burst of new stickies cycles through the palette. */
let lastStickyColour: ColourKey | null = null;

export async function newNote(groupId: Id | null = useUi.getState().currentGroupId, text = ''): Promise<Id> {
  const id = await createItem({ kind: 'note', groupId, text });
  void maybeRequestPersistence();
  return id;
}

export async function newSticky(
  groupId: Id | null = useUi.getState().currentGroupId,
  text = '',
  colour?: ColourKey,
): Promise<Id> {
  const c = colour ?? nextColour(lastStickyColour);
  lastStickyColour = c;
  const id = await createItem({ kind: 'sticky', groupId, text, colour: c });
  void maybeRequestPersistence();
  return id;
}

/** "Paste as stickies": one sticky per non-empty line (list markers removed). */
export async function stickiesFromLines(text: string, groupId: Id | null): Promise<Id[]> {
  const lines = text
    .split('\n')
    .map((l) => l.replace(/^\s*(?:[-*+•]|\d+[.)])\s+(\[[ xX]\]\s+)?/, '').trim())
    .filter(Boolean);
  const ids: Id[] = [];
  for (const line of lines) ids.push(await newSticky(groupId, line));
  return ids;
}

/** A group still exists and isn't in the Trash (URLs can outlive groups). */
export async function liveGroupId(id: Id | null): Promise<Id | null> {
  if (!id) return null;
  const g = await db.groups.get(id);
  return g && !g.deletedAt ? id : null;
}
