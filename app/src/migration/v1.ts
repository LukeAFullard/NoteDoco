import { db } from '@/data/db';
import { deviceId } from '@/data/device';
import { encodeVersion } from '@/data/repos/versions';
import { getSetting, setSetting } from '@/data/repos/settings';
import type { Attachment, Group, Item, NoteBody, Version } from '@/data/types';
import { analyseText } from '@/lib/textInfo';
import { compareOrder, ordersBetween } from '@/lib/order';
import type { ColourKey } from '@/lib/palette';

/**
 * Brings data over from NoteDoco v1 (P1.10, decision 0002). v1's database is only ever read.
 * Safe to run on every start: it adds v1 records that aren't in v2 yet (by id), so notes
 * written in v1 during the preview period come across too, and nothing is duplicated.
 */
export const V1_DB_NAME = 'note-doco-db';

interface V1Project { id: string; name: string; color: 'signal' | 'verdigris' | 'rust' | 'graphite'; parentId: string | null; archived: boolean; createdAt: string; updatedAt: string }
interface V1Note { id: string; projectId: string | null; title: string; contentMarkdown: string; goalDate: string | null; archived: boolean; createdAt: string; updatedAt: string; recurrence?: 'none' | 'daily' | 'weekly' | 'monthly' }
interface V1Version { id: string; noteId: string; title: string; contentMarkdown: string; savedAt: string }
interface V1Attachment { id: string; noteId: string; filename: string; mimeType: string; size: number; blob: Blob; createdAt: string }
interface V1Settings { id: string; lastBackupDate: string | null; reminderIntervalDays: number }

export interface V1Data {
  projects: V1Project[];
  notes: V1Note[];
  noteVersions: V1Version[];
  attachments: V1Attachment[];
  settings: V1Settings[];
}

export interface MigrationReport {
  found: boolean;
  groups: number;
  notes: number;
  versions: number;
  attachments: number;
  at: string;
}

const COLOURS: Record<V1Project['color'], ColourKey> = { signal: 'apricot', verdigris: 'mint', rust: 'coral', graphite: 'slate' };
const RRULE: Record<string, string> = { daily: 'FREQ=DAILY', weekly: 'FREQ=WEEKLY', monthly: 'FREQ=MONTHLY' };

async function v1Exists(): Promise<boolean | null> {
  if (typeof indexedDB.databases !== 'function') return null; // unknown: fall back to opening
  return (await indexedDB.databases()).some((d) => d.name === V1_DB_NAME);
}

/** Reads every v1 store, or returns null if there's no v1 database (without creating one). */
export async function readV1(): Promise<V1Data | null> {
  if ((await v1Exists()) === false) return null;
  const idb = await new Promise<IDBDatabase | null>((resolve) => {
    const req = indexedDB.open(V1_DB_NAME);
    req.onupgradeneeded = () => req.transaction?.abort(); // it didn't exist: don't create it
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
  if (!idb) return null;
  const all = <T>(store: string) =>
    new Promise<T[]>((resolve) => {
      if (!idb.objectStoreNames.contains(store)) return resolve([]);
      const req = idb.transaction(store).objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result as T[]);
      req.onerror = () => resolve([]);
    });
  const data: V1Data = {
    projects: await all<V1Project>('projects'),
    notes: await all<V1Note>('notes'),
    noteVersions: await all<V1Version>('noteVersions'),
    attachments: await all<V1Attachment>('attachments'),
    settings: await all<V1Settings>('settings'),
  };
  idb.close();
  return data;
}

/** v1 kept the title separately; v2 takes it from the first line, so put it there if needed. */
function noteText(n: V1Note, attachments: V1Attachment[]): string {
  let text = n.contentMarkdown ?? '';
  const title = n.title?.trim();
  const first = analyseText(text).title;
  if (title && title !== 'Untitled note' && first !== title) text = `# ${title}\n\n${text}`;
  if (attachments.length) {
    const links = attachments.map((a) => (a.mimeType.startsWith('image/') ? `![${a.filename}](ndoco:attachment/${a.id})` : `- [${a.filename}](ndoco:attachment/${a.id})`));
    text = `${text.trimEnd()}\n\n## Attachments\n\n${links.join('\n')}\n`;
  }
  return text;
}

export async function migrateFromV1(): Promise<MigrationReport> {
  const at = new Date().toISOString();
  const report: MigrationReport = { found: false, groups: 0, notes: 0, versions: 0, attachments: 0, at };
  const v1 = await readV1();
  if (!v1) return report;
  report.found = true;
  const me = deviceId();

  await db.transaction('rw', [db.groups, db.items, db.noteBodies, db.versions, db.attachments, db.settings], async () => {
    // Groups: keep v1 ids; order siblings by creation time.
    const projects = [...v1.projects].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const v2Groups = await db.groups.toArray();
    const existingGroups = new Set(v2Groups.map((g) => g.id));
    // New records go after whatever is already there, with valid fractional order keys.
    const lastOrder = (orders: string[]) => orders.sort(compareOrder).at(-1) ?? null;
    const byParent = new Map<string | null, V1Project[]>();
    for (const p of projects) {
      if (existingGroups.has(p.id)) continue;
      byParent.set(p.parentId ?? null, [...(byParent.get(p.parentId ?? null) ?? []), p]);
    }
    for (const [parentId, siblings] of byParent) {
      const after = lastOrder(v2Groups.filter((g) => g.parentId === parentId).map((g) => g.order));
      const keys = ordersBetween(after, null, siblings.length);
      for (const [k, p] of siblings.entries()) {
        const g: Group = {
          id: p.id, createdAt: p.createdAt, updatedAt: p.updatedAt, deletedAt: null, rev: 1, updatedBy: me,
          parentId: p.parentId ?? null, name: p.name || 'Untitled group', colour: COLOURS[p.color] ?? 'slate', icon: null,
          order: keys[k]!, archived: !!p.archived, boardId: null, viewPrefs: { view: 'list', sort: 'manual' },
        };
        await db.groups.add(g);
        report.groups++;
      }
    }

    // Notes (with their attachments listed at the end, as v1 showed them under the note).
    const v2Items = await db.items.toArray();
    const existingItems = new Set(v2Items.map((i) => i.id));
    const attByNote = new Map<string, V1Attachment[]>();
    for (const a of v1.attachments) attByNote.set(a.noteId, [...(attByNote.get(a.noteId) ?? []), a]);
    const knownGroups = new Set([...existingGroups, ...v1.projects.map((p) => p.id)]);
    const newNotes = [...v1.notes].filter((n) => !existingItems.has(n.id)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const notesByGroup = new Map<string | null, V1Note[]>();
    for (const n of newNotes) {
      const g = n.projectId && knownGroups.has(n.projectId) ? n.projectId : null;
      notesByGroup.set(g, [...(notesByGroup.get(g) ?? []), n]);
    }
    const noteOrder = new Map<string, string>();
    for (const [groupId, list] of notesByGroup) {
      const after = lastOrder(v2Items.filter((i) => i.groupId === groupId).map((i) => i.order));
      ordersBetween(after, null, list.length).forEach((key, k) => noteOrder.set(list[k]!.id, key));
    }
    for (const n of newNotes) {
      const text = noteText(n, attByNote.get(n.id) ?? []);
      const info = analyseText(text);
      const item: Item = {
        id: n.id, createdAt: n.createdAt, updatedAt: n.updatedAt, deletedAt: null, rev: 1, updatedBy: me,
        kind: 'note', groupId: n.projectId && knownGroups.has(n.projectId) ? n.projectId : null,
        order: noteOrder.get(n.id)!, title: info.title, preview: info.preview, colour: null, tags: info.tags, manualTags: [],
        pinned: false, archived: !!n.archived,
        when: null, due: n.goalDate ? { start: n.goalDate.slice(0, 10), end: null, allDay: true, tz: null } : null,
        reminders: [], recurrence: RRULE[n.recurrence ?? 'none'] ?? null, task: null,
        stats: { checklistTotal: info.checklistTotal, checklistDone: info.checklistDone, words: info.words }, thumbnailId: null,
      };
      const body: NoteBody = { itemId: n.id, format: 'markdown', text };
      await db.items.add(item);
      await db.noteBodies.add(body);
      report.notes++;
    }

    const existingVersions = new Set(await db.versions.toCollection().primaryKeys());
    for (const v of v1.noteVersions) {
      if (existingVersions.has(v.id)) continue;
      const row: Version = { id: v.id, itemId: v.noteId, createdAt: v.savedAt, reason: 'migration', snapshot: encodeVersion({ title: v.title, format: 'markdown', text: v.contentMarkdown }) };
      await db.versions.add(row);
      report.versions++;
    }

    const existingAtt = new Set(await db.attachments.toCollection().primaryKeys());
    for (const a of v1.attachments) {
      if (existingAtt.has(a.id)) continue;
      const row: Attachment = { id: a.id, itemId: a.noteId, name: a.filename, mime: a.mimeType, size: a.size, sha256: '', blob: a.blob, createdAt: a.createdAt };
      await db.attachments.add(row);
      report.attachments++;
    }

    const s = v1.settings.find((x) => x.id === 'app-settings');
    if (s?.lastBackupDate && !(await getSetting<string | null>('lastBackupAt', null))) await setSetting('lastBackupAt', s.lastBackupDate);
    await setSetting('migration:v1', report);
  });
  return report;
}
