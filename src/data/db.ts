import Dexie, { type Table } from 'dexie';
import type {
  Attachment,
  Board,
  BoardEdge,
  BoardNode,
  Group,
  InkDoc,
  InkPage,
  Item,
  Layout,
  Link,
  NoteBody,
  Setting,
  StickyBody,
  Stroke,
  TaskRef,
  Version,
} from './types';
import { taskRefsFor } from './taskRefs';

export const DB_NAME = 'notedoco';

/**
 * The v2 database. The v1 database ("note-doco-db") is a different database and is only
 * ever read, during migration.
 *
 * Schema changes: add a new `this.version(n)` block with an `upgrade` function, never edit
 * an existing one, and add a migration test (see db.test.ts).
 *
 * Note: IndexedDB cannot index booleans or null, so flags like `pinned` and `done` are
 * filtered in memory, and records with `deletedAt: null` are simply absent from that index.
 */
export class NoteDocoDB extends Dexie {
  groups!: Table<Group, string>;
  items!: Table<Item, string>;
  noteBodies!: Table<NoteBody, string>;
  stickyBodies!: Table<StickyBody, string>;
  inkDocs!: Table<InkDoc, string>;
  inkPages!: Table<InkPage, string>;
  strokes!: Table<Stroke, string>;
  boards!: Table<Board, string>;
  boardNodes!: Table<BoardNode, string>;
  boardEdges!: Table<BoardEdge, string>;
  links!: Table<Link, [string, string, string]>;
  taskRefs!: Table<TaskRef, string>;
  attachments!: Table<Attachment, string>;
  versions!: Table<Version, string>;
  layouts!: Table<Layout, string>;
  settings!: Table<Setting, string>;

  constructor(name = DB_NAME) {
    super(name);
    this.version(1).stores({
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
    });
    // Version 2 (Phase 2, time): index repeating items (`recurrence` is null for most items,
    // so only repeating ones are in the index), and index the checklist lines of existing
    // notes and stickies for Today and Tasks.
    this.version(2)
      .stores({ items: 'id, kind, groupId, [groupId+order], *tags, when.start, due.start, createdAt, updatedAt, deletedAt, recurrence' })
      .upgrade(async (tx) => {
        const bodies = [...(await tx.table<NoteBody>('noteBodies').toArray()), ...(await tx.table<StickyBody>('stickyBodies').toArray())];
        const refs = bodies.flatMap((b) => taskRefsFor(b.itemId, b.text));
        await tx.table<TaskRef>('taskRefs').clear();
        if (refs.length) await tx.table<TaskRef>('taskRefs').bulkAdd(refs);
      });
  }
}

export const db = new NoteDocoDB();
