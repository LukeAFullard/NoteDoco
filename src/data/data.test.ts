import { db } from './db';
import { buildTree, createGroup, listGroups, moveGroup, restoreGroup, trashGroup, updateGroup } from './repos/groups';
import { createItem, duplicateItem, emptyTrash, listItems, setManualTags, listTrash, moveItem, purgeTrash, restoreItems, setBodyText, trashItems } from './repos/items';
import { moveItemWithUndo, trashItemsWithUndo } from './actions';
import { redo, undo, useUndo } from './undo';
import { describeStorageError, openStorage, useStorageHealth } from './health';
import { freshDb } from '@/test/db';

beforeEach(freshDb);

describe('groups', () => {
  it('creates groups in order and builds a tree', async () => {
    const work = await createGroup({ name: 'Work', colour: 'sky' });
    const home = await createGroup({ name: 'Home' });
    const launch = await createGroup({ name: 'Launch', parentId: work });
    const tree = buildTree(await listGroups());
    expect(tree.map((n) => n.group.name)).toEqual(['Work', 'Home']);
    expect(tree[0]!.children.map((n) => n.group.id)).toEqual([launch]);
    expect((await db.groups.get(home))!.colour).toBe('slate');
  });

  it('stamps every write', async () => {
    const id = await createGroup({ name: 'Work' });
    const before = (await db.groups.get(id))!;
    await updateGroup(id, { name: 'Work stuff' });
    const after = (await db.groups.get(id))!;
    expect(after.rev).toBe(before.rev + 1);
    expect(after.updatedBy).toBe(before.updatedBy);
    expect(after.updatedAt >= before.updatedAt).toBe(true);
  });

  it('reorders and refuses to nest a group inside itself', async () => {
    const a = await createGroup({ name: 'A' });
    const b = await createGroup({ name: 'B' });
    const c = await createGroup({ name: 'C', parentId: a });
    await moveGroup(b, null, a);
    expect((await listGroups()).filter((g) => !g.parentId).map((g) => g.name)).toEqual(['B', 'A']);
    await expect(moveGroup(a, c)).rejects.toThrow(/inside itself/);
  });

  it('trashes and restores a group with its sub-groups and items, but not earlier-trashed items', async () => {
    const work = await createGroup({ name: 'Work' });
    const sub = await createGroup({ name: 'Sub', parentId: work });
    const n1 = await createItem({ kind: 'note', groupId: sub, text: 'hello' });
    const n2 = await createItem({ kind: 'note', groupId: work, text: 'old' });
    await trashItems([n2]);
    await new Promise((r) => setTimeout(r, 2)); // distinct timestamps
    await trashGroup(work);
    expect(await listGroups()).toHaveLength(0);
    await restoreGroup(work);
    expect((await listGroups()).map((g) => g.name).sort()).toEqual(['Sub', 'Work']);
    expect((await db.items.get(n1))!.deletedAt).toBeNull();
    expect((await db.items.get(n2))!.deletedAt).not.toBeNull();
  });
});

describe('items', () => {
  it('derives title, preview, checklist stats and tags on save', async () => {
    const id = await createItem({ kind: 'note', text: '# Groceries\n- [ ] milk\n- [x] eggs #food' });
    const it = (await db.items.get(id))!;
    expect(it).toMatchObject({ title: 'Groceries', preview: 'milk eggs #food', tags: ['food'] });
    expect(it.stats).toEqual({ checklistTotal: 2, checklistDone: 1, words: 4 });
  });

  it('merges picker tags with text tags and keeps them apart', async () => {
    const id = await createItem({ kind: 'note', text: 'Plan #work' });
    await setManualTags(id, ['#Urgent', 'urgent', ' client ']);
    expect((await db.items.get(id))!.tags).toEqual(['client', 'urgent', 'work']);
    await setBodyText(id, 'Plan, no tags now');
    expect((await db.items.get(id))!.tags).toEqual(['client', 'urgent']);
  });

  it('duplicates an item right after the original', async () => {
    const a = await createItem({ kind: 'sticky', text: 'a', colour: 'mint' });
    const b = await createItem({ kind: 'sticky', text: 'b' });
    const c = await duplicateItem(a);
    expect((await listItems(null)).map((i) => i.id)).toEqual([a, c, b]);
    expect((await db.stickyBodies.get(c))!.text).toBe('a');
    expect((await db.items.get(c))!.colour).toBe('mint');
  });

  it('creates notes and stickies with bodies, in the Inbox by default', async () => {
    const note = await createItem({ kind: 'note', text: 'Plan\nstep one' });
    const sticky = await createItem({ kind: 'sticky', text: 'Call Sam', colour: 'coral' });
    expect((await listItems(null)).map((i) => i.id)).toEqual([note, sticky]);
    expect((await db.noteBodies.get(note))!.format).toBe('markdown');
    expect((await db.stickyBodies.get(sticky))!.size).toBe('M');
    await setBodyText(note, 'Renamed\nbody');
    expect((await db.items.get(note))!.title).toBe('Renamed');
  });

  it('moves items between groups and keeps manual order', async () => {
    const g = await createGroup({ name: 'G' });
    const a = await createItem({ kind: 'note', groupId: g, text: 'a' });
    const b = await createItem({ kind: 'note', groupId: g, text: 'b' });
    const c = await createItem({ kind: 'note', text: 'c' });
    await moveItem(c, g, a);
    expect((await listItems(g)).map((i) => i.id)).toEqual([c, a, b]);
  });

  it('restores into the Inbox when the item’s group is gone', async () => {
    const g = await createGroup({ name: 'G' });
    const a = await createItem({ kind: 'note', groupId: g, text: 'a' });
    await trashItems([a]);
    await trashGroup(g);
    await restoreItems([a]);
    expect((await db.items.get(a))!.groupId).toBeNull();
  });

  it('purges only items trashed longer ago than the retention period', async () => {
    const a = await createItem({ kind: 'note', text: 'a' });
    const b = await createItem({ kind: 'sticky', text: 'b' });
    await trashItems([a, b]);
    await db.items.update(a, { deletedAt: '2026-01-01T00:00:00.000Z' });
    expect(await purgeTrash(30, new Date('2026-09-26T00:00:00Z'))).toBe(1);
    expect(await db.items.get(a)).toBeUndefined();
    expect(await db.noteBodies.get(a)).toBeUndefined();
    expect((await listTrash()).map((i) => i.id)).toEqual([b]);
  });

  it('empties the Trash, including versions and attachments', async () => {
    const a = await createItem({ kind: 'note', text: 'a' });
    const keep = await createItem({ kind: 'note', text: 'keep' });
    await db.versions.add({ id: 'v', itemId: a, createdAt: '2026-01-01', reason: 'idle', snapshot: new Uint8Array() });
    await trashItems([a]);
    expect(await emptyTrash()).toBe(1);
    expect(await db.items.get(a)).toBeUndefined();
    expect(await db.versions.get('v')).toBeUndefined();
    expect(await db.items.get(keep)).toBeDefined();
  });
});

describe('undo', () => {
  it('undoes and redoes trashing', async () => {
    const a = await createItem({ kind: 'note', text: 'a' });
    await trashItemsWithUndo([a]);
    expect(await listItems(null)).toHaveLength(0);
    await undo();
    expect(await listItems(null)).toHaveLength(1);
    await redo();
    expect(await listItems(null)).toHaveLength(0);
  });

  it('undoes a move back to the exact previous position', async () => {
    const g = await createGroup({ name: 'G' });
    const a = await createItem({ kind: 'note', text: 'a' });
    const b = await createItem({ kind: 'note', text: 'b' });
    await moveItemWithUndo(a, g);
    await undo();
    expect((await listItems(null)).map((i) => i.id)).toEqual([a, b]);
    expect(useUndo.getState().future).toHaveLength(1);
  });
});

describe('storage health', () => {
  it('reports failure instead of silently falling back to memory', async () => {
    vi.spyOn(db, 'open').mockRejectedValueOnce(Object.assign(new Error('blocked'), { name: 'SecurityError' }));
    const state = await openStorage();
    expect(state.status).toBe('failed');
    expect(useStorageHealth.getState()).toMatchObject({ status: 'failed' });
  });

  it('explains common failures in plain words', () => {
    expect(describeStorageError(Object.assign(new Error('x'), { name: 'QuotaExceededError' }))).toMatch(/out of space/);
    expect(describeStorageError(new Error('?'))).toMatch(/can’t open its storage/);
  });

  it('opens normally', async () => {
    expect((await openStorage()).status).toBe('ok');
  });
});

describe('failed saves', () => {
  it('shows the storage banner for storage failures, not for ordinary errors', async () => {
    const Dexie = (await import('dexie')).default;
    const { isStorageFailure, reportStorageError } = await import('./health');
    useStorageHealth.setState({ status: 'ok' });
    expect(isStorageFailure(new Error('a bug'))).toBe(false);
    expect(isStorageFailure(new Dexie.ConstraintError('duplicate key'))).toBe(false);
    reportStorageError(new Error('a bug'));
    expect(useStorageHealth.getState().status).toBe('ok');

    const quota = new Dexie.AbortError('aborted', Object.assign(new Error('full'), { name: 'QuotaExceededError' }));
    expect(isStorageFailure(quota)).toBe(true);
    reportStorageError(quota);
    const s = useStorageHealth.getState();
    expect(s.status === 'failed' && s.message).toMatch(/out of space/);

    useStorageHealth.setState({ status: 'ok' });
    reportStorageError(new Dexie.DatabaseClosedError());
    expect(useStorageHealth.getState().status).toBe('failed');
  });
});
