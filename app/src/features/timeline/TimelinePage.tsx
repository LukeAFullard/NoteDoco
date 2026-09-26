import { useEffect, useState, type KeyboardEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Bookmark, CalendarSearch, Columns3, Minus, Plus, Rows3, SlidersHorizontal, Trash2 } from 'lucide-react';
import { Menu as AriaMenu, MenuTrigger, Popover, Separator } from 'react-aria-components';
import { Pane } from '@/app/Pane';
import { setCurrentGroup } from '@/app/ui';
import { toastWithUndo } from '@/app/undoActions';
import { Button, IconButton } from '@/design/Button';
import { Dialog } from '@/design/Dialog';
import { MenuItem } from '@/design/Menu';
import { Switch } from '@/design/Switch';
import { showToast } from '@/design/toast';
import { placedBetween } from '@/data/agenda';
import { useGroupTree } from '@/data/hooks';
import { deleteLayout, listLayouts, putLayout, saveLayout } from '@/data/repos/layouts';
import { recordUndo } from '@/data/undo';
import type { GroupNode } from '@/data/repos/groups';
import type { Group } from '@/data/types';
import { todayLocal } from '@/lib/time';
import { allLanes, orderLanes, LANE_MODE_LABELS, type LaneMode } from './layout';
import { ZOOMS, ZOOM_LABELS, zoomBy } from './scale';
import { currentView, jumpTo, setView, timelineCenter, useTimeline, DEFAULT_VIEW, type TimelineView } from './store';
import { TimelineCanvas, type Window } from './TimelineCanvas';
import { TimelineFeed } from './TimelineFeed';
import { LanePicker } from './LanePicker';

const select = 'h-8 rounded-panel border border-border bg-surface px-2 text-sm';
const popover = 'min-w-56 max-h-[60vh] overflow-auto rounded-panel border border-border bg-surface p-1 shadow-lg outline-none';

function flatten(nodes: GroupNode[], depth = 0, out: { group: Group; depth: number }[] = []) {
  for (const n of nodes) {
    out.push({ group: n.group, depth });
    flatten(n.children, depth + 1, out);
  }
  return out;
}

function useIsNarrow() {
  const q = '(max-width: 639px)';
  const [narrow, setNarrow] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setNarrow(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return narrow;
}

function zoomTo(dir: 1 | -1) {
  const center = timelineCenter();
  setView({ zoom: zoomBy(useTimeline.getState().zoom, dir) });
  jumpTo(center);
}

function Layouts() {
  const layouts = useLiveQuery(() => listLayouts('timeline'), []) ?? [];
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  return (
    <>
      <MenuTrigger>
        <IconButton label="Saved layouts" size="sm">
          <Bookmark size={16} />
        </IconButton>
        <Popover className={popover} placement="bottom end">
          <AriaMenu aria-label="Saved layouts" className="outline-none">
            <MenuItem onAction={() => setNaming(true)}>Save this layout…</MenuItem>
            {layouts.length > 0 && <Separator className="my-1 border-t border-border" />}
            {layouts.map((l) => (
              <MenuItem key={l.id} onAction={() => setView({ ...DEFAULT_VIEW, ...(l.spec as Partial<TimelineView>) })}>
                {l.name}
              </MenuItem>
            ))}
            {layouts.length > 0 && <Separator className="my-1 border-t border-border" />}
            {layouts.map((l) => (
              <MenuItem
                key={`del-${l.id}`}
                danger
                onAction={async () => {
                  const gone = await deleteLayout(l.id);
                  if (!gone) return;
                  recordUndo({ label: `Deleted layout “${l.name}”`, undo: () => putLayout(gone), redo: async () => void (await deleteLayout(l.id)) });
                  toastWithUndo(`Deleted layout “${l.name}”`);
                }}
              >
                <Trash2 size={14} aria-hidden /> Delete “{l.name}”
              </MenuItem>
            ))}
          </AriaMenu>
        </Popover>
      </MenuTrigger>
      {naming && (
        <Dialog isOpen onOpenChange={(o) => !o && setNaming(false)} title="Save this layout">
          <form
            className="space-y-3 p-5 pt-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!name.trim()) return;
              await saveLayout('timeline', name.trim(), currentView());
              showToast({ message: `Saved layout “${name.trim()}”` }, 3000);
              setName('');
              setNaming(false);
            }}
          >
            <p className="text-sm text-muted">Saves the lanes, their order, the zoom and the display options, so you can come back to them in one click.</p>
            <label className="block text-sm">
              Name
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Work vs home" className="mt-1 h-9 w-full rounded-panel border border-border bg-surface px-2" />
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onPress={() => setNaming(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" isDisabled={!name.trim()}>
                Save
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}

/** The timeline (TIME-3 to TIME-10): items across time, in lanes by group, tag, kind or colour. */
export function TimelinePage() {
  const { zoom, laneMode, order, hidden, undated, orientation } = useTimeline();
  const narrow = useIsNarrow();
  const tree = useGroupTree();
  const groupsFlat = flatten(tree ?? []);
  const groups = new Map(groupsFlat.map((g) => [g.group.id, g.group] as [string, Group]));
  const [win, setWin] = useState<Window | null>(null);
  const [picking, setPicking] = useState(false);
  useEffect(() => setCurrentGroup(null), []);

  const loaded = useLiveQuery(() => (win ? placedBetween(win.from, win.to, { undated }) : Promise.resolve(null)), [win?.from, win?.to, undated]);
  // useLiveQuery keeps the previous result while a new window loads, so nothing flickers.
  const placed = loaded ?? [];

  const tags = [...new Set(placed.flatMap((p) => p.item.tags))].sort();
  const possible = allLanes(laneMode, groupsFlat, tags);
  const lanes = orderLanes(possible, order[laneMode] ?? [], hidden[laneMode] ?? []);

  const onKey = (e: KeyboardEvent) => {
    const el = e.target as HTMLElement;
    if (el.closest('input, textarea, select, [contenteditable="true"]') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === '+' || e.key === '=') zoomTo(-1);
    else if (e.key === '-') zoomTo(1);
    else if (e.key === 't' || e.key === 'T') jumpTo(todayLocal());
    else return;
    e.preventDefault();
  };

  return (
    <Pane
      title="Timeline"
      actions={
        <div className="flex items-center gap-1">
          <Button size="sm" onPress={() => jumpTo(todayLocal())}>
            Today
          </Button>
          <Layouts />
        </div>
      }
    >
      <div className="flex h-full min-h-0 flex-col" onKeyDown={onKey}>
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2 text-sm">
          {!narrow && (
            <>
              <div className="flex items-center gap-0.5">
                <IconButton label="Zoom in" size="sm" isDisabled={zoom === ZOOMS[0]} onPress={() => zoomTo(-1)}>
                  <Plus size={15} />
                </IconButton>
                <select
                  aria-label="Zoom"
                  value={zoom}
                  onChange={(e) => {
                    const c = timelineCenter();
                    setView({ zoom: e.target.value as typeof zoom });
                    jumpTo(c);
                  }}
                  className={select}
                >
                  {ZOOMS.map((z) => (
                    <option key={z} value={z}>
                      {ZOOM_LABELS[z]}
                    </option>
                  ))}
                </select>
                <IconButton label="Zoom out" size="sm" isDisabled={zoom === ZOOMS.at(-1)} onPress={() => zoomTo(1)}>
                  <Minus size={15} />
                </IconButton>
              </div>
              <label className="flex items-center gap-1.5">
                <CalendarSearch size={15} className="text-muted" aria-hidden />
                <span className="sr-only">Go to date</span>
                <input type="date" aria-label="Go to date" onChange={(e) => e.target.value && jumpTo(e.target.value)} className={select} />
              </label>
            </>
          )}
          <label className="flex items-center gap-1.5">
            <span className="text-muted">Lanes by</span>
            <select aria-label="Lanes by" value={laneMode} onChange={(e) => setView({ laneMode: e.target.value as LaneMode })} className={select}>
              {(Object.keys(LANE_MODE_LABELS) as LaneMode[]).map((m) => (
                <option key={m} value={m}>
                  {LANE_MODE_LABELS[m]}
                </option>
              ))}
            </select>
          </label>
          {laneMode !== 'none' && (
            <Button size="sm" variant="ghost" onPress={() => setPicking(true)}>
              <SlidersHorizontal size={15} aria-hidden /> Choose lanes
            </Button>
          )}
          {!narrow && (
            <div role="radiogroup" aria-label="Layout" className="flex rounded-panel border border-border p-0.5">
              {(['lanes', 'columns'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={orientation === v}
                  aria-label={v === 'lanes' ? 'Lanes: time left to right' : 'Columns: time top to bottom'}
                  title={v === 'lanes' ? 'Lanes: time left to right' : 'Columns: time top to bottom'}
                  onClick={() => {
                    const c = timelineCenter();
                    setView({ orientation: v });
                    jumpTo(c);
                  }}
                  className={`flex h-7 w-8 items-center justify-center rounded ${orientation === v ? 'bg-accent-soft text-accent' : 'text-muted'}`}
                >
                  {v === 'lanes' ? <Rows3 size={15} /> : <Columns3 size={15} />}
                </button>
              ))}
            </div>
          )}
          <Switch isSelected={undated} onChange={(v) => setView({ undated: v })}>
            Undated by created date
          </Switch>
        </div>
        {narrow ? (
          <TimelineFeed lanes={lanes} groups={groups} />
        ) : lanes.length ? (
          <TimelineCanvas placed={placed} lanes={lanes} onWindow={(w) => setWin((prev) => (prev && prev.from === w.from && prev.to === w.to ? prev : w))} />
        ) : (
          <p className="p-6 text-sm text-muted">All lanes are hidden. Use Choose lanes to show some.</p>
        )}
        {!narrow && (
          <p className="border-t border-border px-3 py-1.5 text-xs text-muted">
            Drag to reschedule{laneMode === 'group' ? ' or move between groups' : laneMode === 'colour' ? ' or recolour' : ''}; drag an end to change how long. Double-click a lane to add a sticky there.
          </p>
        )}
      </div>
      {picking && <LanePicker lanes={possible} onClose={() => setPicking(false)} />}
    </Pane>
  );
}
