import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, StickyNote, Tags } from 'lucide-react';
import { db } from '@/data/db';
import { useGroups } from '@/data/hooks';
import { Pane } from '@/app/Pane';
import { setCurrentGroup } from '@/app/ui';
import { setPrefs, usePrefs } from '@/app/prefs';
import { Button } from '@/design/Button';
import { Switch } from '@/design/Switch';
import { EmptyState } from '@/design/EmptyState';
import { cn } from '@/design/cn';
import { COLOUR_KEYS, COLOUR_LABELS, type ColourKey } from '@/lib/palette';
import { ItemCollection } from '@/features/items/ItemCollection';
import { useLocalCollectionPrefs } from '@/features/items/useCollectionPrefs';
import { SORT_LABELS, type SortMode } from '@/features/items/sortItems';
import { usePasteToCreate } from '@/features/capture/usePasteToCreate';
import { useCreate } from '@/features/capture/useCreate';
import { useColourMeanings } from './colourMeanings';
import { ColourMeaningsDialog } from './ColourMeaningsDialog';

type GroupFilter = 'all' | 'inbox' | string;

/** Every sticky across groups, as a wall (STK-4), filterable by colour and group. */
export function StickiesPage() {
  const stickies = useLiveQuery(async () => (await db.items.where('kind').equals('sticky').toArray()).filter((i) => !i.deletedAt && !i.archived), []);
  const groups = useGroups() ?? [];
  const meanings = useColourMeanings();
  const tidy = usePrefs((p) => p.tidyStickies);
  const create = useCreate();
  const [colours, setColours] = useState<Set<ColourKey>>(new Set());
  const [group, setGroup] = useState<GroupFilter>('all');
  const [prefs, setCollectionPrefs] = useLocalCollectionPrefs('stickies', { view: 'cards', sort: 'updated' });
  const [editingMeanings, setEditingMeanings] = useState(false);

  const targetGroup = group === 'all' || group === 'inbox' ? null : group;
  useEffect(() => setCurrentGroup(targetGroup), [targetGroup]);
  usePasteToCreate(targetGroup, 'stickies');

  const visible = (stickies ?? []).filter(
    (s) =>
      (!colours.size || colours.has(s.colour ?? 'lemon')) &&
      (group === 'all' || (group === 'inbox' ? s.groupId === null : s.groupId === group)),
  );
  const toggleColour = (c: ColourKey) =>
    setColours((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });

  return (
    <Pane
      title="Stickies"
      actions={
        <Button size="sm" variant="primary" onPress={() => void create.sticky(targetGroup)}>
          <Plus size={16} aria-hidden /> Sticky
        </Button>
      }
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <div role="group" aria-label="Filter by colour" className="flex flex-wrap gap-1.5">
          {COLOUR_KEYS.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={colours.has(c)}
              onClick={() => toggleColour(c)}
              className={cn(
                'flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs',
                colours.has(c) ? 'border-accent bg-accent-soft font-medium' : 'border-border hover:border-accent/60',
              )}
            >
              <span className="h-3.5 w-3.5 rounded-[2px] border border-black/10" style={{ background: `var(--sticky-${c})` }} aria-hidden />
              {meanings[c] || COLOUR_LABELS[c]}
            </button>
          ))}
          <Button size="sm" variant="ghost" onPress={() => setEditingMeanings(true)}>
            <Tags size={14} aria-hidden /> Meanings
          </Button>
        </div>
        <span className="flex-1" />
        <select aria-label="Filter by group" value={group} onChange={(e) => setGroup(e.target.value)} className="h-8 rounded-panel border border-border bg-surface px-2 text-sm">
          <option value="all">All groups</option>
          <option value="inbox">Inbox</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.icon ? `${g.icon} ` : ''}
              {g.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Sort by"
          value={prefs.sort}
          onChange={(e) => setCollectionPrefs({ ...prefs, sort: e.target.value as SortMode })}
          className="h-8 rounded-panel border border-border bg-surface px-2 text-sm"
        >
          {(Object.keys(SORT_LABELS) as SortMode[]).map((s) => (
            <option key={s} value={s}>
              {SORT_LABELS[s]}
            </option>
          ))}
        </select>
        <Switch isSelected={tidy} onChange={(v) => setPrefs({ tidyStickies: v })}>
          Tidy
        </Switch>
      </div>
      {stickies && (
        <ItemCollection
          items={visible}
          prefs={{ ...prefs, view: 'cards' }}
          empty={
            <EmptyState
              icon={<StickyNote size={32} />}
              title={stickies.length ? 'No stickies match these filters' : 'Your sticky wall is empty'}
              body={
                stickies.length
                  ? 'Try clearing the colour or group filters.'
                  : 'Press S for a new sticky, or paste a list here to get one sticky per line.'
              }
              action={
                !stickies.length && (
                  <Button variant="primary" onPress={() => void create.sticky(targetGroup)}>
                    <Plus size={16} aria-hidden /> New sticky
                  </Button>
                )
              }
            />
          }
        />
      )}
      {editingMeanings && <ColourMeaningsDialog initial={meanings} onClose={() => setEditingMeanings(false)} />}
    </Pane>
  );
}
