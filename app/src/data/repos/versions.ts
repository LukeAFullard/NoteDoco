import { strFromU8, strToU8, unzlibSync, zlibSync } from 'fflate';
import { db } from '../db';
import { newId } from '@/lib/ids';
import { recordUndo } from '../undo';
import { setBodyText } from './items';
import type { Id, NoteBody, Version } from '../types';

export interface VersionContent {
  title: string;
  format: NoteBody['format'];
  text: string;
}

export const MAX_VERSIONS_PER_ITEM = 150;
export const SNAPSHOT_INTERVAL_MS = 5 * 60_000;

export const encodeVersion = (c: VersionContent) => zlibSync(strToU8(JSON.stringify(c)), { level: 6 });
export const decodeVersion = (v: Version): VersionContent => JSON.parse(strFromU8(unzlibSync(v.snapshot))) as VersionContent;

export async function listVersions(itemId: Id): Promise<Version[]> {
  return (await db.versions.where('[itemId+createdAt]').between([itemId, ''], [itemId, '￿']).toArray()).reverse();
}

/**
 * Saves a snapshot of a note unless it's identical to the latest one, or (for idle snapshots)
 * the latest one is younger than `minAgeMs`. Keeps the first version and the newest ones.
 */
export async function snapshotNote(itemId: Id, reason: Version['reason'], minAgeMs = 0, now = new Date()): Promise<boolean> {
  const [item, body] = await Promise.all([db.items.get(itemId), db.noteBodies.get(itemId)]);
  if (!item || !body) return false;
  const latest = await db.versions.where('[itemId+createdAt]').between([itemId, ''], [itemId, '￿']).last();
  if (latest) {
    if (now.getTime() - new Date(latest.createdAt).getTime() < minAgeMs) return false;
    const prev = decodeVersion(latest);
    if (prev.text === body.text && prev.format === body.format) return false;
  }
  await db.versions.add({ id: newId(), itemId, createdAt: now.toISOString(), reason, snapshot: encodeVersion({ title: item.title, format: body.format, text: body.text }) });
  await prune(itemId);
  return true;
}

async function prune(itemId: Id) {
  const all = await db.versions.where('[itemId+createdAt]').between([itemId, ''], [itemId, '￿']).primaryKeys();
  if (all.length <= MAX_VERSIONS_PER_ITEM) return;
  // Keep the very first version; drop the oldest of the rest.
  await db.versions.bulkDelete(all.slice(1, all.length - MAX_VERSIONS_PER_ITEM + 1));
}

/** Restores a version. The current text is snapshotted first, and the restore can be undone. */
export async function restoreVersion(versionId: Id): Promise<void> {
  const v = await db.versions.get(versionId);
  if (!v) throw new Error('Version not found');
  const current = await db.noteBodies.get(v.itemId);
  await snapshotNote(v.itemId, 'restore');
  const content = decodeVersion(v);
  await setBodyText(v.itemId, content.text, content.format);
  if (current) {
    recordUndo({
      label: 'Restored an earlier version',
      undo: () => setBodyText(v.itemId, current.text, current.format),
      redo: () => setBodyText(v.itemId, content.text, content.format),
    });
  }
}
