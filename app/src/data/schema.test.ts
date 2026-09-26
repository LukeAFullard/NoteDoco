import { db } from './db';
import { freshDb } from '@/test/db';

beforeEach(freshDb);

/**
 * Guards against editing a shipped schema version. If this fails, add a new
 * `this.version(n)` block with an upgrade function instead of changing version 1,
 * then update this snapshot and add a migration test for the upgrade.
 */
it('keeps the version 1 schema stable', () => {
  const schema = Object.fromEntries(
    db.tables.map((t) => [t.name, [t.schema.primKey.src, ...t.schema.indexes.map((i) => i.src)].join(', ')]),
  );
  expect(db.verno).toBe(1);
  expect(schema).toMatchInlineSnapshot(`
    {
      "attachments": "id, itemId, sha256",
      "boardEdges": "id, boardId",
      "boardNodes": "id, boardId, itemId",
      "boards": "itemId",
      "groups": "id, parentId, order, deletedAt",
      "inkDocs": "id, itemId",
      "inkPages": "id, docId, [docId+order]",
      "items": "id, kind, groupId, [groupId+order], *tags, when.start, due.start, createdAt, updatedAt, deletedAt",
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
