import { db } from '@/data/db';
import { freshDb } from '@/test/db';
import { newSticky, stickiesFromLines } from './capture';

beforeEach(freshDb);

it('cycles sticky colours so a burst of ideas isn’t all one colour', async () => {
  const a = await newSticky(null, 'a');
  const b = await newSticky(null, 'b');
  expect((await db.items.get(a))!.colour).not.toBe((await db.items.get(b))!.colour);
});

it('pastes a list as one sticky per line', async () => {
  const ids = await stickiesFromLines('- milk\n\n* eggs\n1. bread\n- [ ] jam\n[x] done', null);
  const texts = await Promise.all(ids.map(async (id) => (await db.stickyBodies.get(id))!.text));
  expect(texts).toEqual(['milk', 'eggs', 'bread', '- [ ] jam', '- [x] done']);
  expect((await db.items.get(ids[3]!))!.stats.checklistTotal).toBe(1);
});
