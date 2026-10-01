import type { Item } from '@/data/types';
import { sortItems } from './sortItems';

const it_ = (id: string, o: Partial<Item>) => ({ id, order: id, title: id, pinned: false, updatedAt: '', createdAt: '', ...o }) as Item;

it('puts pinned first, then sorts by the chosen mode', () => {
  const items = [it_('a', { title: 'item 10' }), it_('b', { title: 'item 2', pinned: true }), it_('c', { title: 'Item 1' })];
  expect(sortItems(items, 'title').map((i) => i.id)).toEqual(['b', 'c', 'a']);
  expect(sortItems(items, 'manual').map((i) => i.id)).toEqual(['b', 'a', 'c']);
});

it('puts untitled items last when sorting by title', () => {
  expect(sortItems([it_('x', { title: '' }), it_('y', { title: 'Zebra' })], 'title').map((i) => i.id)).toEqual(['y', 'x']);
});
