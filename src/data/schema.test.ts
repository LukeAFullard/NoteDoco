import Dexie from 'dexie';
import { db, NoteDocoDB } from './db';
import { freshDb } from '@/test/db';

beforeEach(freshDb);

/**
 * Guards against editing a shipped schema version. If this fails, add a new
 * `this.version(n)` block with an upgrade function instead of changing an existing one,
 * then update this snapshot and add a migration test for the upgrade.
 */
it('keeps the shipped schema stable', () => {
  const schema = Object.fromEntries(
    db.tables.map((t) => [t.name, [t.schema.primKey.src, ...t.schema.indexes.map((i) => i.src)].join(', ')]),
  );
  expect(db.verno).toBe(2);
  expect(schema).toMatchInlineSnapshot(`
    {
      "attachments": "id, itemId, sha256",
      "boardEdges": "id, boardId",
      "boardNodes": "id, boardId, itemId",
      "boards": "itemId",
      "groups": "id, parentId, order, deletedAt",
      "inkDocs": "id, itemId",
      "inkPages": "id, docId, [docId+order]",
      "items": "id, kind, groupId, [groupId+order], *tags, when.start, due.start, createdAt, updatedAt, deletedAt, recurrence",
      "layouts": "id, kind",
      "links": "[fromItemId+toItemId+kind], fromItemId, toItemId",
      "noteBodies": "itemId",
      "settings": "key",
      "stickyBodies": "itemId",
      "strokes": "id, pageId",
      "taskRefs": "id, itemId, date",
      "versions": "id, itemId, [itemId+createdAt]",
    }
  `);
});

/** The version 1 schema exactly as shipped, to test upgrades from it. */
const V1_STORES = {
  groups: 'id, parentId, order, deletedAt',
  items: 'id, kind, groupId, [groupId+order], *tags, when.start, due.start, createdAt, updatedAt, deletedAt',
  noteBodies: 'itemId',
  stickyBodies: 'itemId',
  inkDocs: 'id, itemId',
  inkPages: 'id, docId, [docId+order]',
  strokes: 'id, pageId',
  boards: 'itemId',
  boardNodes: 'id, boardId, itemId',
  boardEdges: 'id, boardId',
  links: '[fromItemId+toItemId+kind], fromItemId, toItemId',
  taskRefs: 'id, itemId, date',
  attachments: 'id, itemId, sha256',
  versions: 'id, itemId, [itemId+createdAt]',
  layouts: 'id, kind',
  settings: 'key',
};

it('upgrades version 1: indexes checklist lines and repeating items', async () => {
  const name = 'upgrade-test';
  await Dexie.delete(name);
  const v1 = new Dexie(name);
  v1.version(1).stores(V1_STORES);
  await v1.open();
  const item = (id: string, recurrence: string | null) => ({ id, kind: 'note', groupId: null, order: 'a0', tags: [], when: null, due: null, recurrence, createdAt: '', updatedAt: '', deletedAt: null });
  await v1.table('items').bulkAdd([item('n1', 'FREQ=WEEKLY'), item('s1', null)]);
  await v1.table('noteBodies').add({ itemId: 'n1', format: 'markdown', text: 'Plan\n- [ ] book venue @2026-10-02\n- [x] invite' });
  await v1.table('stickyBodies').add({ itemId: 's1', text: '- [ ] milk', inkPageId: null, size: 'M', stuckTo: null });
  v1.close();

  const v2 = new NoteDocoDB(name);
  await v2.open();
  const refs = await v2.taskRefs.orderBy('id').toArray();
  expect(refs.map((r) => [r.itemId, r.text, r.date, r.done])).toEqual([
    ['n1', 'book venue @2026-10-02', '2026-10-02', false],
    ['n1', 'invite', null, true],
    ['s1', 'milk', null, false],
  ]);
  expect(await v2.items.where('recurrence').above('').primaryKeys()).toEqual(['n1']);
  v2.close();
  await Dexie.delete(name);
});
