import { db } from '@/data/db';
import { freshDb } from '@/test/db';
import { createItem, setBodyText, setManualTags, trashItems, updateItem } from '@/data/repos/items';
import { createGroup } from '@/data/repos/groups';
import { SearchIndex } from './SearchIndex';

beforeEach(freshDb);

it('finds items by title and body, with typos and prefixes, and snippets around the match', async () => {
  await createItem({ kind: 'note', text: '# Launch plan\nShip the **beta** on Friday' });
  await createItem({ kind: 'sticky', text: 'Buy milk' });
  const index = new SearchIndex(db);
  await index.sync();
  expect(index.search('lanch').map((h) => h.title)).toEqual(['Launch plan']); // typo
  expect(index.search('fri').map((h) => h.title)).toEqual(['Launch plan']); // prefix
  expect(index.search('beta')[0]!.snippet).toBe('Ship the beta on Friday'); // title not repeated
});

it('applies filters: tags, kind, colour, group, pinned, open checklists', async () => {
  const g = await createGroup({ name: 'Launch plan' });
  const a = await createItem({ kind: 'note', groupId: g, text: 'Tasks #work\n- [ ] one' });
  const b = await createItem({ kind: 'sticky', text: 'Idea #work', colour: 'coral' });
  await setManualTags(b, ['urgent']);
  await updateItem(b, { pinned: true });
  const index = new SearchIndex(db);
  await index.sync();
  const ids = (q: string) => index.search(q).map((h) => h.id).sort();
  expect(ids('#work')).toEqual([a, b].sort());
  expect(ids('#work kind:sticky')).toEqual([b]);
  expect(ids('colour:coral')).toEqual([b]);
  expect(ids('in:launch')).toEqual([a]);
  expect(ids('is:pinned tag:urgent')).toEqual([b]);
  expect(ids('is:open')).toEqual([a]);
});

it('syncs incrementally: edits, trash and new items', async () => {
  const a = await createItem({ kind: 'note', text: 'Alpha' });
  const index = new SearchIndex(db);
  expect(await index.sync()).toBe(1);
  expect(await index.sync()).toBe(0);
  await setBodyText(a, 'Bravo');
  expect(await index.sync()).toBe(1);
  expect(index.search('alpha')).toHaveLength(0);
  expect(index.search('bravo')).toHaveLength(1);
  await trashItems([a]);
  await index.sync();
  expect(index.search('bravo')).toHaveLength(0);
});
