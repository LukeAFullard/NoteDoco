import { db } from '../db';
import { touched } from '../meta';
import { recordUndo } from '../undo';
import type { Item, NoteBody, StickyBody } from '../types';
import { analyseText, renameTagInText } from '@/lib/textInfo';
import { mergeTags } from './items';

export interface TagCount {
  tag: string;
  count: number;
}

/** Every tag on live items, most used first. */
export async function listTags(): Promise<TagCount[]> {
  const counts = new Map<string, number>();
  await db.items.each((i) => {
    if (i.deletedAt) return;
    for (const t of i.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  });
  return [...counts].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export async function itemsWithTag(tag: string): Promise<Item[]> {
  return (await db.items.where('tags').equals(tag).toArray()).filter((i) => !i.deletedAt);
}

export const normaliseTag = (t: string) => t.trim().replace(/^#+/, '').toLowerCase().replace(/\s+/g, '-');

/**
 * Renames a tag everywhere: in tag-picker tags and in #tags written in note and sticky text.
 * Renaming to an existing tag merges the two. Undo restores every affected item exactly.
 */
export async function renameTag(fromRaw: string, toRaw: string): Promise<number> {
  const from = normaliseTag(fromRaw);
  const to = normaliseTag(toRaw);
  if (!from || !to || from === to) return 0;
  const snapshots: Array<{ item: Item; note?: NoteBody; sticky?: StickyBody }> = [];

  await db.transaction('rw', db.items, db.noteBodies, db.stickyBodies, async () => {
    for (const it of await db.items.where('tags').equals(from).toArray()) {
      const note = it.kind === 'note' ? await db.noteBodies.get(it.id) : undefined;
      const sticky = it.kind === 'sticky' ? await db.stickyBodies.get(it.id) : undefined;
      snapshots.push({ item: it, note, sticky });
      const manualTags = [...new Set(it.manualTags.map((t) => (t === from ? to : t)))].sort();
      let inline: string[] = [];
      if (note) {
        const text = renameTagInText(note.text, from, to);
        await db.noteBodies.put({ ...note, text });
        inline = analyseText(text, note.format).tags;
      } else if (sticky) {
        const text = renameTagInText(sticky.text, from, to);
        await db.stickyBodies.put({ ...sticky, text });
        inline = analyseText(text).tags;
      }
      await db.items.put(touched(it, { manualTags, tags: mergeTags(manualTags, inline) }));
    }
  });

  if (snapshots.length) {
    recordUndo({
      label: `Renamed #${from} to #${to}`,
      undo: async () => {
        await db.transaction('rw', db.items, db.noteBodies, db.stickyBodies, async () => {
          for (const s of snapshots) {
            const now = await db.items.get(s.item.id);
            if (now) await db.items.put(touched(now, { manualTags: s.item.manualTags, tags: s.item.tags }));
            if (s.note) await db.noteBodies.put(s.note);
            if (s.sticky) await db.stickyBodies.put(s.sticky);
          }
        });
      },
      redo: async () => void (await renameTag(from, to)),
    });
  }
  return snapshots.length;
}
