import { db } from '@/data/db';
import { freshDb } from '@/test/db';
import { createItem } from '@/data/repos/items';
import { linkedNote, mergeIntoNote, promoteToNote } from './promote';

beforeEach(freshDb);

it('promotes a sticky to a linked note in the same group', async () => {
  const s = await createItem({ kind: 'sticky', text: 'Big idea\nmore detail', colour: 'coral' });
  const n = await promoteToNote(s);
  expect((await db.noteBodies.get(n))!.text).toBe('Big idea\nmore detail');
  expect((await db.items.get(n))!.title).toBe('Big idea');
  expect(await linkedNote(s)).toBe(n);
  expect((await db.items.get(s))!.deletedAt).toBeNull();
});

it('merges stickies into one note, keeping checklists', async () => {
  const a = await createItem({ kind: 'sticky', text: 'Call Sam' });
  const b = await createItem({ kind: 'sticky', text: '- [ ] Buy milk' });
  const n = await mergeIntoNote([a, b]);
  expect((await db.noteBodies.get(n))!.text).toBe('Merged stickies\n\n- Call Sam\n- [ ] Buy milk');
  expect((await db.items.get(n))!.stats.checklistTotal).toBe(1);
});
