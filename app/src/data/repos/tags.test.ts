import { db } from '../db';
import { freshDb } from '@/test/db';
import { undo } from '../undo';
import { createItem, setManualTags } from './items';
import { listTags, renameTag } from './tags';

beforeEach(freshDb);

it('counts tags on live items', async () => {
  await createItem({ kind: 'note', text: 'A #work #home' });
  await createItem({ kind: 'sticky', text: 'B #work' });
  expect(await listTags()).toEqual([
    { tag: 'work', count: 2 },
    { tag: 'home', count: 1 },
  ]);
});

it('renames tags in text and picker tags, merging into an existing tag, and undoes exactly', async () => {
  const a = await createItem({ kind: 'note', text: 'Plan #Work' });
  const b = await createItem({ kind: 'sticky', text: 'Call' });
  await setManualTags(b, ['work', 'client']);
  expect(await renameTag('work', 'client')).toBe(2);
  expect((await db.noteBodies.get(a))!.text).toBe('Plan #client');
  expect((await db.items.get(a))!.tags).toEqual(['client']);
  expect((await db.items.get(b))!.manualTags).toEqual(['client']);
  expect(await listTags()).toEqual([{ tag: 'client', count: 2 }]);

  await undo();
  expect((await db.noteBodies.get(a))!.text).toBe('Plan #Work');
  expect((await db.items.get(b))!.manualTags).toEqual(['client', 'work']);
});
