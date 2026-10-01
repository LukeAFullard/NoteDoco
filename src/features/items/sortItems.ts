import type { Item } from '@/data/types';
import { compareOrder } from '@/lib/order';

export type SortMode = 'manual' | 'updated' | 'created' | 'title';

export const SORT_LABELS: Record<SortMode, string> = {
  manual: 'Manual order',
  updated: 'Last edited',
  created: 'Date created',
  title: 'Title',
};

/** Sorts items; pinned items always come first. */
export function sortItems(items: Item[], mode: SortMode): Item[] {
  const by: Record<SortMode, (a: Item, b: Item) => number> = {
    manual: (a, b) => compareOrder(a.order, b.order),
    updated: (a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0),
    created: (a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0),
    title: (a, b) => (a.title || '￿').localeCompare(b.title || '￿', undefined, { sensitivity: 'base', numeric: true }),
  };
  return [...items].sort((a, b) => Number(b.pinned) - Number(a.pinned) || by[mode](a, b));
}
