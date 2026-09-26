import { useEffect, type ReactNode } from 'react';
import { LayoutGrid, List, X } from 'lucide-react';
import type { Item } from '@/data/types';
import { cn } from '@/design/cn';
import { IconButton, Button } from '@/design/Button';
import { ItemCard, type Density } from './ItemCard';
import { ItemActionsMenu } from './ItemMenu';
import { clearSelection, selectAll, selectRange, toggleSelected, useSelection } from './selection';
import { SORT_LABELS, sortItems, type SortMode } from './sortItems';

export type CollectionView = 'list' | 'cards';

export interface CollectionPrefs {
  view: CollectionView;
  sort: SortMode;
}

/** View and sort controls for a collection header. */
export function CollectionControls({ prefs, onChange }: { prefs: CollectionPrefs; onChange: (p: CollectionPrefs) => void }) {
  return (
    <div className="flex items-center gap-1">
      <select
        aria-label="Sort by"
        value={prefs.sort}
        onChange={(e) => onChange({ ...prefs, sort: e.target.value as SortMode })}
        className="h-8 rounded-panel border border-border bg-surface px-2 text-sm"
      >
        {(Object.keys(SORT_LABELS) as SortMode[]).map((s) => (
          <option key={s} value={s}>
            {SORT_LABELS[s]}
          </option>
        ))}
      </select>
      <div role="radiogroup" aria-label="View" className="flex rounded-panel border border-border p-0.5">
        {(
          [
            ['list', 'List', <List key="l" size={16} />],
            ['cards', 'Cards', <LayoutGrid key="c" size={16} />],
          ] as const
        ).map(([v, label, icon]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={prefs.view === v}
            aria-label={label}
            onClick={() => onChange({ ...prefs, view: v })}
            className={cn('flex h-7 w-7 items-center justify-center rounded', prefs.view === v ? 'bg-accent-soft text-accent' : 'text-muted hover:text-text')}
          >
            {icon}
          </button>
        ))}
      </div>
    </div>
  );
}

function BulkBar({ items }: { items: Item[] }) {
  const ids = useSelection((s) => s.ids);
  const selected = items.filter((i) => ids.has(i.id));
  if (!selected.length) return null;
  return (
    <div className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-surface px-4 py-2 text-sm" role="toolbar" aria-label="Selection">
      <IconButton label="Clear selection" size="sm" onPress={clearSelection}>
        <X size={16} />
      </IconButton>
      <span className="font-medium">{selected.length} selected</span>
      <Button size="sm" variant="ghost" onPress={() => selectAll(items.map((i) => i.id))}>
        Select all
      </Button>
      <span className="flex-1" />
      <ItemActionsMenu items={selected} triggerLabel="Actions for selected items" />
    </div>
  );
}

/** A list or grid of items with pinned-first sorting, multi-select and bulk actions. */
export function ItemCollection({ items, prefs, empty, hrefFor = (i) => `/items/${i.id}` }: {
  items: Item[];
  prefs: CollectionPrefs;
  empty: ReactNode;
  hrefFor?: (i: Item) => string;
}) {
  const ids = useSelection((s) => s.ids);
  const selecting = ids.size > 0;
  const sorted = sortItems(items, prefs.sort);
  const order = sorted.map((i) => i.id);

  // Leaving the collection (or pressing Escape) ends selection.
  useEffect(() => clearSelection, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && clearSelection();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!items.length) return <>{empty}</>;

  const density: Density = prefs.view === 'list' ? 'row' : 'card';
  // A collection of only stickies is laid out like a wall: stickies at their own sizes, wrapping.
  const wall = prefs.view === 'cards' && sorted.every((i) => i.kind === 'sticky');
  const onSelect = (item: Item, e: { shiftKey: boolean }) => (e.shiftKey ? selectRange(item.id, order) : toggleSelected(item.id));

  return (
    <div>
      <BulkBar items={sorted} />
      <ul
        className={cn(
          prefs.view === 'list'
            ? 'flex flex-col px-2 py-2'
            : wall
              ? 'flex flex-wrap items-start justify-center gap-4 p-4 sm:justify-start sm:gap-6 sm:p-5'
              : 'grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] items-start gap-4 p-4',
        )}
      >
        {sorted.map((item) => (
          <li key={item.id}>
            <ItemCard item={item} density={density} selected={ids.has(item.id)} selecting={selecting} onSelect={onSelect} href={hrefFor(item)} />
          </li>
        ))}
      </ul>
    </div>
  );
}
