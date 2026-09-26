import { db } from '@/data/db';
import { freshDb } from '@/test/db';
import { listItems, moveItem } from '@/data/repos/items';
import { decodeVersion } from '@/data/repos/versions';
import { getSetting } from '@/data/repos/settings';
import { blobText } from '@/lib/blob';
import { V1_DB_NAME, migrateFromV1, readV1 } from './v1';

/** Builds a v1 database exactly as v1 (schema version 4) created it. */
async function makeV1(data: Record<string, unknown[]>) {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.open(V1_DB_NAME, 4);
    req.onupgradeneeded = () => {
      const d = req.result;
      d.createObjectStore('projects', { keyPath: 'id' }).createIndex('by-parent', 'parentId');
      const notes = d.createObjectStore('notes', { keyPath: 'id' });
      notes.createIndex('by-project', 'projectId');
      notes.createIndex('by-goalDate', 'goalDate');
      d.createObjectStore('noteVersions', { keyPath: 'id' }).createIndex('by-note', 'noteId');
      d.createObjectStore('settings', { keyPath: 'id' });
      d.createObjectStore('attachments', { keyPath: 'id' }).createIndex('by-note', 'noteId');
    };
    req.onsuccess = () => {
      const d = req.result;
      const tx = d.transaction(Object.keys(data), 'readwrite');
      for (const [store, rows] of Object.entries(data)) for (const r of rows) tx.objectStore(store).put(r);
      tx.oncomplete = () => {
        d.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
}

const deleteV1 = () => new Promise<void>((r) => { const q = indexedDB.deleteDatabase(V1_DB_NAME); q.onsuccess = q.onerror = () => r(); });

beforeEach(async () => {
  await freshDb();
  await deleteV1();
});

const T = '2026-05-01T09:00:00.000Z';
const fixture = {
  projects: [
    { id: 'p-work', name: 'Work', color: 'verdigris', parentId: null, archived: false, createdAt: T, updatedAt: T },
    { id: 'p-client', name: 'Client A', color: 'rust', parentId: 'p-work', archived: false, createdAt: T, updatedAt: T },
  ],
  notes: [
    { id: 'n-1', projectId: 'p-client', title: 'Kick-off', contentMarkdown: 'Agenda\n- [ ] intro\n- [x] scope #client', goalDate: '2026-06-30', archived: false, createdAt: T, updatedAt: T, recurrence: 'weekly' },
    { id: 'n-2', projectId: null, title: 'Groceries', contentMarkdown: '# Groceries\n- milk', goalDate: null, archived: true, createdAt: T, updatedAt: T },
  ],
  noteVersions: [{ id: 'v-1', noteId: 'n-1', title: 'Kick-off', contentMarkdown: 'old agenda', goalDate: null, savedAt: T }],
  settings: [{ id: 'app-settings', lastBackupDate: '2026-04-01T00:00:00.000Z', reminderIntervalDays: 14, notificationsEnabled: false }],
  attachments: [{ id: 'a-1', noteId: 'n-1', filename: 'plan.pdf', mimeType: 'application/pdf', size: 3, blob: new Blob(['pdf']), createdAt: T }],
};

it('does nothing (and creates nothing) when there is no v1 database', async () => {
  expect(await readV1()).toBeNull();
  expect((await migrateFromV1()).found).toBe(false);
  expect((await indexedDB.databases()).some((d) => d.name === V1_DB_NAME)).toBe(false);
});

it('brings over groups, notes, dates, repeats, versions, attachments and settings', async () => {
  await makeV1(fixture);
  const r = await migrateFromV1();
  expect(r).toMatchObject({ found: true, groups: 2, notes: 2, versions: 1, attachments: 1 });

  const client = (await db.groups.get('p-client'))!;
  expect(client).toMatchObject({ name: 'Client A', parentId: 'p-work', colour: 'coral' });
  expect((await db.groups.get('p-work'))!.colour).toBe('mint');

  const n1 = (await db.items.get('n-1'))!;
  expect(n1).toMatchObject({ groupId: 'p-client', title: 'Kick-off', recurrence: 'FREQ=WEEKLY', tags: ['client'] });
  expect(n1.due).toEqual({ start: '2026-06-30', end: null, allDay: true, tz: null });
  expect(n1.stats).toMatchObject({ checklistTotal: 2, checklistDone: 1 });
  const body = (await db.noteBodies.get('n-1'))!.text;
  expect(body.startsWith('# Kick-off\n\nAgenda')).toBe(true);
  expect(body).toContain('[plan.pdf](ndoco:attachment/a-1)');

  expect((await db.items.get('n-2'))!).toMatchObject({ archived: true, title: 'Groceries', groupId: null });
  expect((await db.noteBodies.get('n-2'))!.text).toBe('# Groceries\n- milk'); // title already first: not repeated
  expect(decodeVersion((await db.versions.get('v-1'))!).text).toBe('old agenda');
  expect(await blobText((await db.attachments.get('a-1'))!.blob)).toBe('pdf');
  expect(await getSetting('lastBackupAt', null)).toBe('2026-04-01T00:00:00.000Z');
});

it('is safe to run again: nothing duplicated, new v1 notes picked up, v2 edits kept', async () => {
  await makeV1(fixture);
  await migrateFromV1();
  await db.items.update('n-1', { title: 'Edited in v2' });
  await makeV1({ notes: [...fixture.notes, { id: 'n-3', projectId: null, title: 'Later', contentMarkdown: 'written in v1 later', goalDate: null, archived: false, createdAt: T, updatedAt: T }] });
  const again = await migrateFromV1();
  expect(again).toMatchObject({ groups: 0, notes: 1, versions: 0, attachments: 0 });
  expect((await db.items.get('n-1'))!.title).toBe('Edited in v2');
  // Migrated items have valid order keys, so they can be reordered afterwards.
  const inbox = await listItems(null);
  await moveItem(inbox.at(-1)!.id, null, inbox[0]!.id);
});

it('never modifies the v1 database', async () => {
  await makeV1(fixture);
  await migrateFromV1();
  const v1 = (await readV1())!;
  expect(v1.notes.map((n) => n.title).sort()).toEqual(['Groceries', 'Kick-off']);
  expect(v1.projects).toHaveLength(2);
});
