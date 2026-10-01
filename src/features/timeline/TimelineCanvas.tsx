import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { useNavigate } from 'react-router';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { placedKey, type Placed } from '@/data/agenda';
import type { Item, LocalDate, TimeSpan } from '@/data/types';
import { createItem } from '@/data/repos/items';
import { dateItemsWithUndo, reschedulePlacedWithUndo, rescheduleWithUndo, trashItemsWithUndo } from '@/data/actions';
import { dragKind, readDragItems } from '@/lib/dnd';
import { toastWithUndo } from '@/app/undoActions';
import { cn } from '@/design/cn';
import { addDays, allDaySpan, diffDays, timedSpan, todayLocal } from '@/lib/time';
import type { ColourKey } from '@/lib/palette';
import { openSticky } from '@/features/stickies/stickyDialog';
import { density, laneKeysFor, packLane, INBOX_LANE, NO_COLOUR_LANE, NO_TAG_LANE, type Entry, type Lane, type LaneMode, type PackedLane } from './layout';
import { DETAIL, STEP_MINUTES, dateAtPos, dayAtPos, makeScale, posOfDate, posOfDay, spanExtent, ticks, zoomBy } from './scale';
import { TimelineCard } from './TimelineCard';
import { setTimelineCenter, setView, timelineCenter, useTimeline } from './store';
import { draggedSpan, type DragKind } from './drag';

// Geometry (px). "Axis" is along time; "cross" is across lanes.
const LANE_HEAD = { lanes: 184, columns: 44 };
const AXIS_HEAD = { lanes: 52, columns: 76 };
const SIZES = {
  card: { cross: { lanes: 50, columns: 176 }, min: { lanes: 140, columns: 44 }, rows: 5 },
  chip: { cross: { lanes: 24, columns: 112 }, min: { lanes: 72, columns: 22 }, rows: 6 },
};
const LANE_PAD = 6;
const COLLAPSED = { lanes: 30, columns: 44 };
const DENSITY_CROSS = 36;

export interface Window {
  from: LocalDate;
  to: LocalDate;
}

interface DragState {
  key: string;
  kind: DragKind;
  pointerId: number;
  start: { x: number; y: number };
  delta: number;
  lane: string | null;
  moved: boolean;
}


function useNow(ms = 60_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** Group or colour for an item dropped into another lane (tag and kind lanes don't change anything). */
function laneChange(mode: LaneMode, lane: string): Partial<Pick<Item, 'groupId' | 'colour'>> {
  if (mode === 'group') return { groupId: lane === INBOX_LANE ? null : lane };
  if (mode === 'colour') return { colour: lane === NO_COLOUR_LANE ? null : (lane as ColourKey) };
  return {};
}
const canChangeLane = (mode: LaneMode) => mode === 'group' || mode === 'colour';

export function TimelineCanvas({ placed, lanes, onWindow }: { placed: Placed[]; lanes: Lane[]; onWindow: (w: Window) => void }) {
  const { zoom, laneMode, collapsed, orientation, focus, focusNonce } = useTimeline();
  const h = orientation === 'lanes';
  const o = orientation;
  const navigate = useNavigate();
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [center, setCenter] = useState<LocalDate>(focus);
  const scale = useMemo(() => makeScale(zoom, center), [zoom, center]);
  const detail = DETAIL[zoom];
  const size = detail === 'density' ? null : SIZES[detail];
  // The rendered range (the visible part plus a screen either side) and where the view starts.
  const [view, setViewport] = useState({ a: 0, b: 0, start: 0, len: 0 });
  const frame = useRef(0);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const pendingFocus = useRef<{ id: string; focus: boolean } | null>(null);
  const pendingScroll = useRef<{ day: LocalDate; offset: number } | null>(null);
  const now = useNow();
  const laneHead = LANE_HEAD[o];
  const axisHead = AXIS_HEAD[o];

  // ---- layout -------------------------------------------------------------------------------
  const packed = useMemo(() => {
    const byLane = new Map<string, Entry[]>(lanes.map((l) => [l.key, []]));
    const all: Entry[] = [];
    for (const p of placed) {
      const [a, b] = spanExtent(scale, p.span);
      for (const lane of laneKeysFor(p.item, laneMode)) {
        const list = byLane.get(lane);
        if (!list) continue;
        const e: Entry = { key: `${placedKey(p)}@${lane}`, placed: p, lane, a, b: Math.max(b, a + (size ? size.min[o] : 2)) };
        list.push(e);
        all.push(e);
      }
    }
    const result = new Map<string, PackedLane & { all: Entry[] }>();
    for (const [lane, list] of byLane) result.set(lane, { ...packLane(list, size?.rows ?? 1, 4, size ? size.min[o] : 100), all: list });
    return { byLane: result, all };
  }, [placed, lanes, scale, laneMode, size, o]);

  const geometry = useMemo(() => {
    let off = 0;
    return lanes.map((lane) => {
      const p = packed.byLane.get(lane.key)!;
      const cross = collapsed.includes(lane.key)
        ? COLLAPSED[o]
        : detail === 'density'
          ? Math.max(DENSITY_CROSS, h ? DENSITY_CROSS : 120)
          : LANE_PAD * 2 + p.rows * size!.cross[o];
      const g = { lane, off, cross: h ? cross : Math.max(cross, 150), packed: p };
      off += g.cross;
      return g;
    });
  }, [lanes, packed, collapsed, detail, size, h, o]);
  const totalCross = geometry.reduce((n, g) => n + g.cross, 0);

  // ---- scrolling and the visible window -------------------------------------------------------
  const readViewport = useCallback(() => {
    const el = scroller.current;
    if (!el) return null;
    // The lane headers stick over the first `laneHead` px of the view, so the visible part of
    // the axis starts at the scroll position itself.
    const a = h ? el.scrollLeft : el.scrollTop;
    const len = (h ? el.clientWidth : el.clientHeight) - laneHead;
    return { a: Math.max(0, a), b: a + len, len };
  }, [h, laneHead]);

  const scrollToDay = useCallback(
    (day: LocalDate, offset: number) => {
      const el = scroller.current;
      if (!el) return;
      // Today means now (it matters at the Hours zoom); other days mean their start.
      const pos = (day === todayLocal() ? posOfDate(scale, new Date()) : posOfDay(scale, day)) - offset;
      if (h) el.scrollLeft = pos;
      else el.scrollTop = pos;
    },
    [scale, h],
  );

  const update = useCallback(() => {
    const v = readViewport();
    if (!v) return;
    setViewport({ a: v.a - v.len, b: v.b + v.len, start: v.a, len: v.len });
    setTimelineCenter(dayAtPos(scale, v.a + v.len / 2));
    // Report the loaded window in steps, so small scrolls don't re-query.
    const step = Math.max(7, Math.ceil(v.len / scale.pxPerDay));
    const firstDay = diffDays(scale.origin, dayAtPos(scale, Math.max(0, v.a - v.len)));
    const lastDay = diffDays(scale.origin, dayAtPos(scale, v.b + v.len));
    const from = addDays(scale.origin, Math.floor(firstDay / step) * step - step);
    const to = addDays(scale.origin, Math.ceil(lastDay / step) * step + step);
    onWindow({ from, to });
    // Near either end: re-centre the scale where we are, keeping the same view.
    if (v.a < v.len * 1.5 || v.b > scale.length - v.len * 1.5) {
      const mid = dayAtPos(scale, v.a + v.len / 2);
      if (mid !== center) {
        pendingScroll.current = { day: mid, offset: v.len / 2 };
        setCenter(mid);
      }
    }
  }, [readViewport, scale, onWindow, center]);

  // At most one update per frame while scrolling.
  const onScroll = useCallback(() => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      update();
    });
  }, [update]);

  // Jump to the focus date (Today button, date picker, zoom change, first open).
  useLayoutEffect(() => {
    const v = readViewport();
    // Today sits a third of the way in (so what's next shows); other dates in the middle.
    const offset = v ? (focus === todayLocal() ? v.len / 3 : v.len / 2) : 200;
    if (diffDays(scale.origin, focus) < 30 || diffDays(focus, addDays(scale.origin, scale.days)) < 30) {
      pendingScroll.current = { day: focus, offset };
      setCenter(focus);
    } else scrollToDay(focus, offset);
    update();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, focusNonce, zoom, orientation]);

  useLayoutEffect(() => {
    if (!pendingScroll.current) return;
    scrollToDay(pendingScroll.current.day, pendingScroll.current.offset);
    pendingScroll.current = null;
    update();
  }, [scale, scrollToDay, update]);

  useEffect(() => {
    const onResize = () => update();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [update]);

  // ---- helpers -------------------------------------------------------------------------------
  const open = (item: Item) => (item.kind === 'sticky' ? openSticky(item.id) : navigate(`/items/${item.id}`));

  const laneAt = (clientX: number, clientY: number): string | null => {
    const rect = content.current?.getBoundingClientRect();
    if (!rect) return null;
    const cross = (h ? clientY - rect.top : clientX - rect.left) - axisHead;
    return geometry.find((g) => cross >= g.off && cross < g.off + g.cross)?.lane.key ?? null;
  };

  const createAt = async (lane: string, when: TimeSpan) => {
    const extra = laneChange(laneMode, lane);
    const id = await createItem({
      kind: 'sticky',
      // From tag, kind or colour lanes, new stickies go to the Inbox.
      groupId: laneMode === 'group' ? (extra.groupId ?? null) : null,
      colour: laneMode === 'colour' ? (extra.colour ?? null) : null,
      when,
    });
    if (laneMode === 'tag' && lane !== NO_TAG_LANE) {
      const { setManualTags } = await import('@/data/repos/items');
      await setManualTags(id, [lane]);
    }
    openSticky(id, true);
  };

  // ---- dragging (pointer) --------------------------------------------------------------------
  const entryByKey = useMemo(() => new Map(packed.all.map((e) => [e.key, e])), [packed]);

  const onCardPointerDown = (e: ReactPointerEvent, entry: Entry, kind: DragKind) => {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setActiveKey(entry.key);
    setDrag({ key: entry.key, kind, pointerId: e.pointerId, start: { x: e.clientX, y: e.clientY }, delta: 0, lane: entry.lane, moved: false });
  };

  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      if (e.pointerId !== drag.pointerId) return;
      const dx = e.clientX - drag.start.x;
      const dy = e.clientY - drag.start.y;
      const moved = drag.moved || Math.hypot(dx, dy) > 5;
      const lane = drag.kind === 'move' && canChangeLane(laneMode) ? (laneAt(e.clientX, e.clientY) ?? drag.lane) : entryByKey.get(drag.key)?.lane ?? null;
      setDrag({ ...drag, delta: h ? dx : dy, lane, moved });
    };
    const up = async (e: PointerEvent) => {
      if (e.pointerId !== drag.pointerId) return;
      setDrag(null);
      const entry = entryByKey.get(drag.key);
      if (!entry) return;
      if (!drag.moved) return open(entry.placed.item);
      const to = draggedSpan(entry.placed.span, drag.kind, drag.delta, scale);
      const laneMoved = drag.lane && drag.lane !== entry.lane ? laneChange(laneMode, drag.lane) : {};
      if (JSON.stringify(to) === JSON.stringify(entry.placed.span) && !Object.keys(laneMoved).length) return;
      pendingFocus.current = { id: entry.placed.item.id, focus: false };
      toastWithUndo(await reschedulePlacedWithUndo(entry.placed, entry.placed.span, to, entry.placed.line ? {} : laneMoved));
    };
    const cancel = (e: PointerEvent) => e.pointerId === drag.pointerId && setDrag(null);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
  });

  // ---- keyboard ------------------------------------------------------------------------------
  const laneOrder = geometry.map((g) => g.lane.key);
  const sortedIn = (lane: string) => [...(packed.byLane.get(lane)?.entries ?? [])].sort((x, y) => x.a - y.a || x.row - y.row);

  const focusEntry = (key: string) => {
    setActiveKey(key);
    requestAnimationFrame(() => {
      const el = content.current?.querySelector<HTMLElement>(`[data-entry="${CSS.escape(key)}"]`);
      el?.focus();
      el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
  };

  const onCardKey = async (e: KeyboardEvent, entry: Entry) => {
    const next = h ? 'ArrowRight' : 'ArrowDown';
    const prev = h ? 'ArrowLeft' : 'ArrowUp';
    const laneNext = h ? 'ArrowDown' : 'ArrowRight';
    const lanePrev = h ? 'ArrowUp' : 'ArrowLeft';
    const { item } = entry.placed;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open(item);
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && !entry.placed.line) {
      e.preventDefault();
      toastWithUndo(await trashItemsWithUndo([item.id]));
      return;
    }
    if (![next, prev, laneNext, lanePrev].includes(e.key)) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.altKey) {
      // Alt+arrows: reschedule by one unit, or move to the next lane.
      if (e.key === next || e.key === prev) {
        const dir = e.key === next ? 1 : -1;
        const px = (STEP_MINUTES[zoom] / 1440) * scale.pxPerDay * dir;
        const to = draggedSpan(entry.placed.span, 'move', px, scale);
        pendingFocus.current = { id: item.id, focus: true };
        toastWithUndo(await reschedulePlacedWithUndo(entry.placed, entry.placed.span, to));
      } else if (canChangeLane(laneMode) && !entry.placed.line) {
        const i = laneOrder.indexOf(entry.lane) + (e.key === laneNext ? 1 : -1);
        const lane = laneOrder[i];
        if (!lane) return;
        pendingFocus.current = { id: item.id, focus: true };
        toastWithUndo(await rescheduleWithUndo(item, entry.placed.basis, entry.placed.span, entry.placed.span, laneChange(laneMode, lane)));
      }
      return;
    }
    if (e.key === next || e.key === prev) {
      const list = sortedIn(entry.lane);
      const i = list.findIndex((x) => x.key === entry.key) + (e.key === next ? 1 : -1);
      if (list[i]) focusEntry(list[i].key);
      return;
    }
    // Up/down (lanes mode): the nearest item in the next lane that has any.
    const dir = e.key === laneNext ? 1 : -1;
    for (let i = laneOrder.indexOf(entry.lane) + dir; i >= 0 && i < laneOrder.length; i += dir) {
      const list = sortedIn(laneOrder[i]!);
      if (!list.length) continue;
      const nearest = list.reduce((best, x) => (Math.abs(x.a - entry.a) < Math.abs(best.a - entry.a) ? x : best));
      focusEntry(nearest.key);
      return;
    }
  };

  // After a keyboard or drag move, keep focus on the moved item.
  useEffect(() => {
    const pending = pendingFocus.current;
    if (!pending) return;
    const entry = packed.all.find((x) => x.placed.item.id === pending.id && !x.placed.projected) ?? packed.all.find((x) => x.placed.item.id === pending.id);
    // The moved card is a new element (its key includes its date), so focus follows it.
    if (entry && entry.key !== activeKey) {
      pendingFocus.current = null;
      if (pending.focus) focusEntry(entry.key);
      else setActiveKey(entry.key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packed]);

  // One card is in the tab order: the active one, else the first visible.
  const tabKey = activeKey && entryByKey.has(activeKey) ? activeKey : (geometry.flatMap((g) => sortedIn(g.lane.key)).find((x) => x.b >= view.a && x.a <= view.b)?.key ?? null);

  // ---- rendering helpers ---------------------------------------------------------------------
  const along = (a: number, len: number) => (h ? { left: a, width: len } : { top: a, height: len });
  const across = (off: number, len: number) => (h ? { top: off, height: len } : { left: off, width: len });
  const inView = (a: number, b: number) => b >= view.a && a <= view.b;
  const t = useMemo(() => ticks(scale, view.a, view.b), [scale, view.a, view.b]);
  const nowPos = posOfDate(scale, now);
  const dragEntry = drag?.moved ? entryByKey.get(drag.key) : undefined;

  const renderEntries = (g: (typeof geometry)[number]) => {
    if (collapsed.includes(g.lane.key) || !size || detail === 'density') return null;
    const cross = size.cross[o];
    return (
      <>
        {g.packed.entries.filter((e) => inView(e.a, e.b)).map((e) => (
          <TimelineCard
            key={e.key}
            entryKey={e.key}
            placed={e.placed}
            detail={detail}
            horizontal={h}
            laneLabel={g.lane.label}
            active={tabKey === e.key}
            dragging={drag?.moved && drag.key === e.key}
            describedBy="timeline-help"
            // Long items keep their label in view when they start off-screen.
            inset={Math.max(0, Math.min(view.start - e.a, e.b - e.a - 120))}
            style={{ ...along(e.a, e.b - e.a - 2), ...across(LANE_PAD + e.row * cross, cross - 4) }}
            onPointerDown={(ev, kind) => onCardPointerDown(ev, e, kind)}
            onKeyDown={(ev) => void onCardKey(ev, e)}
            onFocus={() => setActiveKey(e.key)}
          />
        ))}
        {g.packed.clusters.filter((c) => inView(c.pos, c.pos + size.min[o])).map((c) => (
          <button
            key={`pill-${c.pos}`}
            type="button"
            onClick={() => {
              setView({ zoom: zoomBy(zoom, -1) });
              useTimeline.setState((s) => ({ focus: dayAtPos(scale, c.pos), focusNonce: s.focusNonce + 1 }));
            }}
            className="absolute z-10 flex items-center justify-center rounded-full border border-border bg-surface px-2 text-xs font-medium text-muted hover:text-text focus-visible:ring-2 focus-visible:ring-focus"
            style={{ ...along(c.pos, Math.min(size.min[o], 64)), ...across(LANE_PAD + (g.packed.rows - 1) * cross, Math.min(cross - 4, 24)) }}
            aria-label={`${c.count} more in ${g.lane.label}: zoom in`}
          >
            +{c.count}
          </button>
        ))}
      </>
    );
  };

  const renderDensity = (g: (typeof geometry)[number]) => {
    if (detail !== 'density' || collapsed.includes(g.lane.key)) return null;
    const bucket = 7 * scale.pxPerDay;
    // Only real dates: a daily repeat's future copies would fill every week.
    const counts = density(g.packed.all.filter((e) => !e.placed.projected), bucket);
    const max = Math.max(1, ...counts.values());
    return [...counts]
      .filter(([b]) => inView(b * bucket, (b + 1) * bucket))
      .map(([b, n]) => (
        <button
          key={b}
          type="button"
          className="absolute rounded-sm bg-accent-fill hover:ring-2 hover:ring-focus focus-visible:ring-2 focus-visible:ring-focus"
          style={{ ...along(b * bucket, Math.max(2, bucket - 1)), ...(h ? { bottom: 6, height: 6 + (n / max) * 22 } : { right: 6, width: 6 + (n / max) * 60 }), opacity: 0.35 + (n / max) * 0.65 }}
          aria-label={`${n} ${n === 1 ? 'item' : 'items'} in the week of ${dayAtPos(scale, b * bucket)}: zoom in`}
          onClick={() => {
            setView({ zoom: 'month' });
            useTimeline.setState((s) => ({ focus: dayAtPos(scale, b * bucket), focusNonce: s.focusNonce + 1 }));
          }}
        />
      ));
  };

  const laneHeader = (g: (typeof geometry)[number]) => {
    const isCollapsed = collapsed.includes(g.lane.key);
    const count = new Set(g.packed.all.map((e) => e.placed.item.id)).size;
    return (
      <div
        className={cn('sticky z-[25] flex shrink-0 gap-1 border-border bg-bg px-2 text-sm', h ? 'left-0 items-start border-r pt-3' : 'top-0 items-center border-b')}
        style={h ? { width: laneHead, height: g.cross } : { height: laneHead, width: g.cross }}
      >
        <button
          type="button"
          aria-expanded={!isCollapsed}
          aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${g.lane.label}`}
          onClick={() => setView({ collapsed: isCollapsed ? collapsed.filter((k) => k !== g.lane.key) : [...collapsed, g.lane.key] })}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted hover:text-text focus-visible:ring-2 focus-visible:ring-focus"
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
        <span className="flex min-w-0 flex-1 items-center gap-1.5" style={{ paddingLeft: h ? g.lane.depth * 10 : 0 }}>
          {g.lane.colour && <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/10" style={{ background: `var(--sticky-${g.lane.colour})` }} />}
          <span className="truncate font-medium">{g.lane.label}</span>
          {count > 0 && <span className="shrink-0 font-mono text-xs text-muted">{count}</span>}
        </span>
        {laneMode !== 'kind' && (
          <button
            type="button"
            aria-label={`Add a sticky to ${g.lane.label}`}
            onClick={() => {
              // On today if it's in view, else on the day in the middle of the view.
              const today = todayLocal();
              const p = posOfDay(scale, today);
              void createAt(g.lane.key, allDaySpan(p >= view.a && p <= view.b ? today : timelineCenter()));
            }}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted hover:text-accent focus-visible:ring-2 focus-visible:ring-focus"
          >
            <Plus size={14} />
          </button>
        )}
      </div>
    );
  };

  const onLaneDoubleClick = (e: React.MouseEvent, lane: string) => {
    if (e.target !== e.currentTarget) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pos = h ? e.clientX - rect.left : e.clientY - rect.top;
    if (zoom === 'hour') {
      const at = dateAtPos(scale, pos);
      at.setMinutes(Math.floor(at.getMinutes() / 30) * 30, 0, 0);
      void createAt(lane, timedSpan(at, new Date(at.getTime() + 60 * 60_000)));
    } else void createAt(lane, allDaySpan(dayAtPos(scale, pos)));
  };

  // ---- the ghost while dragging --------------------------------------------------------------
  let ghost = null;
  if (dragEntry && size) {
    const to = draggedSpan(dragEntry.placed.span, drag!.kind, drag!.delta, scale);
    const [a, b] = spanExtent(scale, to);
    const g = geometry.find((x) => x.lane.key === (drag!.lane ?? dragEntry.lane)) ?? geometry.find((x) => x.lane.key === dragEntry.lane)!;
    const sameLane = g.lane.key === dragEntry.lane;
    const row = sameLane ? (g.packed.entries.find((x) => x.key === dragEntry.key)?.row ?? 0) : 0;
    ghost = (
      <TimelineCard
        placed={{ ...dragEntry.placed, span: to }}
        detail={detail as 'card' | 'chip'}
        horizontal={h}
        laneLabel={g.lane.label}
        active={false}
        ghost
        style={{
          ...along(laneHead + a, Math.max(b, a + size.min[o]) - a - 2),
          ...across(axisHead + g.off + LANE_PAD + row * size.cross[o], size.cross[o] - 4),
          pointerEvents: 'none',
        }}
      />
    );
  }

  const weekendShade = zoom === 'hour' ? t.major.filter((x) => x.weekend) : t.minor.filter((x) => x.weekend);
  const axisLen = scale.length;
  const line = (pos: number, cls: string, key: string) => (
    <div key={key} className={cn('absolute', cls)} style={{ ...along(pos, 1), ...(h ? { top: 0, bottom: 0 } : { left: 0, right: 0 }) }} />
  );
  const labels = (
    <>
      {/* Major labels stick to the start of the view while their month or year is on screen. */}
      {t.major.map((x, i) => {
        const end = t.major[i + 1]?.pos ?? view.b;
        return (
          <div key={`M-${x.pos}`} className="absolute" style={h ? { left: x.pos, width: end - x.pos, top: 6, height: 18 } : { top: x.pos, height: end - x.pos, left: 4, width: axisHead - 8 }}>
            <span className={cn('sticky block w-max whitespace-nowrap px-1.5 text-xs font-semibold', h ? 'left-0' : 'top-0')} style={h ? { left: laneHead } : { top: laneHead }}>
              {x.label}
            </span>
          </div>
        );
      })}
      {t.minor.map((x) => (
        <span
          key={`m-${x.pos}`}
          className={cn('absolute whitespace-nowrap px-1 font-mono text-[11px] text-muted', x.day === todayLocal(now) && zoom !== 'hour' && 'font-semibold text-danger')}
          style={h ? { left: x.pos, top: 28 } : { top: x.pos + (zoom === 'hour' ? 2 : 18), left: 4 }}
        >
          {x.label}
        </span>
      ))}
    </>
  );
  const lane = (g: (typeof geometry)[number]) => (
    <div
      key={g.lane.key}
      role="group"
      aria-label={g.lane.label}
      className={cn('relative flex shrink-0 border-border', h ? 'border-b' : 'flex-col border-r')}
      style={h ? { height: g.cross } : { width: g.cross, height: laneHead + axisLen }}
    >
      {laneHeader(g)}
      <div
        className="relative"
        style={h ? { width: axisLen } : { height: axisLen }}
        onDoubleClick={(e) => onLaneDoubleClick(e, g.lane.key)}
        // Items dragged in from a list or another pane land on that day, in this lane (WS-2).
        onDragOver={(e) => dragKind(e) === 'items' && e.preventDefault()}
        onDrop={async (e) => {
          if (dragKind(e) !== 'items') return;
          e.preventDefault();
          const rect = e.currentTarget.getBoundingClientRect();
          const day = dayAtPos(scale, h ? e.clientX - rect.left : e.clientY - rect.top);
          const ids = readDragItems(e);
          if (ids.length) toastWithUndo(await dateItemsWithUndo(ids, day, laneChange(laneMode, g.lane.key)));
        }}
      >
        {renderEntries(g)}
        {renderDensity(g)}
      </div>
    </div>
  );

  /** Scrolls so `pos` (along the axis) is in the middle of the view. */
  const centreOn = (pos: number) => {
    const el = scroller.current;
    if (!el) return;
    const target = Math.max(0, Math.min(axisLen, pos)) - view.len / 2;
    if (h) el.scrollLeft = target;
    else el.scrollTop = target;
  };

  return (
    <>
      <div
        ref={scroller}
        onScroll={onScroll}
        className="relative min-h-0 flex-1 overflow-auto overscroll-contain"
        role="region"
        aria-label={`Timeline, ${h ? 'time left to right' : 'time top to bottom'}`}
      >
        <p id="timeline-help" className="sr-only">
          Arrow keys move between items. Alt with arrow keys reschedules{canChangeLane(laneMode) ? ' or moves to another lane' : ''}. Enter opens. Plus and minus zoom; T goes to today.
        </p>
        <div
          ref={content}
          className={cn('relative', !h && 'flex')}
          style={h ? { width: laneHead + axisLen, height: axisHead + totalCross } : { width: axisHead + totalCross, height: laneHead + axisLen }}
        >
          {/* Background: weekends, grid lines and the now line. */}
          <div
            aria-hidden
            className="pointer-events-none absolute"
            style={h ? { left: laneHead, top: axisHead, width: axisLen, height: totalCross } : { top: laneHead, left: axisHead, height: axisLen, width: totalCross }}
          >
            {detail === 'card' && weekendShade.map((w) => <div key={`we-${w.day}`} className="absolute bg-surface-2/60" style={{ ...along(w.pos, scale.pxPerDay), ...(h ? { top: 0, bottom: 0 } : { left: 0, right: 0 }) }} />)}
            {t.minor.map((x) => line(x.pos, 'bg-border/50', `g-${x.pos}`))}
            {t.major.map((x) => line(x.pos, 'bg-border', `G-${x.pos}`))}
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute z-20 bg-danger"
            style={h ? { left: laneHead + nowPos, top: axisHead - 6, width: 2, height: totalCross + 6 } : { top: laneHead + nowPos, left: axisHead - 6, height: 2, width: totalCross + 6 }}
          />

          {h ? (
            <>
              <div aria-hidden className="sticky top-0 z-30 flex" style={{ height: axisHead, width: laneHead + axisLen }}>
                <div className="sticky left-0 z-10 shrink-0 border-r border-b border-border bg-bg" style={{ width: laneHead }} />
                <div className="relative shrink-0 border-b border-border bg-bg" style={{ width: axisLen }}>
                  {labels}
                </div>
              </div>
              {geometry.map(lane)}
            </>
          ) : (
            <>
              <div aria-hidden className="sticky left-0 z-30 shrink-0 border-r border-border bg-bg" style={{ width: axisHead, height: laneHead + axisLen }}>
                <div className="sticky top-0 z-10 border-b border-border bg-bg" style={{ height: laneHead }} />
                <div className="relative" style={{ height: axisLen }}>
                  {labels}
                </div>
              </div>
              {geometry.map(lane)}
            </>
          )}
          {ghost}
        </div>
      </div>
      <Overview scale={scale} view={view} now={nowPos} onSeek={centreOn} />
    </>
  );
}

/**
 * The overview scrubber (TIME-8): the whole range in one strip, with today and the part on
 * screen marked. Click or drag to jump; arrow keys move a screen at a time.
 */
function Overview({ scale, view, now, onSeek }: { scale: ReturnType<typeof makeScale>; view: { start: number; len: number }; now: number; onSeek: (pos: number) => void }) {
  const bar = useRef<HTMLDivElement>(null);
  const pct = (pos: number) => `${(pos / scale.length) * 100}%`;
  const seek = (clientX: number) => {
    const r = bar.current!.getBoundingClientRect();
    onSeek(((clientX - r.left) / r.width) * scale.length);
  };
  // Labels: years across a long range, else months, else Mondays.
  const labels: { pos: number; label: string }[] = [];
  const unit = scale.days > 1200 ? 'year' : scale.days > 90 ? 'month' : 'week';
  const fmtMonth = new Intl.DateTimeFormat(undefined, { month: 'short' });
  const fmtDay = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });
  for (let d = scale.origin; d <= addDays(scale.origin, scale.days); d = addDays(d, 1)) {
    const show = unit === 'year' ? d.endsWith('-01-01') : unit === 'month' ? d.endsWith('-01') : new Date(`${d}T12:00`).getDay() === 1;
    if (!show) continue;
    const date = new Date(`${d}T12:00`);
    labels.push({ pos: posOfDay(scale, d), label: unit === 'year' ? d.slice(0, 4) : unit === 'month' ? (d.slice(5, 7) === '01' ? d.slice(0, 4) : fmtMonth.format(date)) : fmtDay.format(date) });
  }
  const step = Math.max(1, Math.ceil(labels.length / 24));
  const centre = dayAtPos(scale, view.start + view.len / 2);
  return (
    <div
      ref={bar}
      role="slider"
      tabIndex={0}
      aria-label="Overview: jump through time"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(((view.start + view.len / 2) / scale.length) * 100)}
      aria-valuetext={new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(`${centre}T12:00`))}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        seek(e.clientX);
      }}
      onPointerMove={(e) => e.buttons === 1 && seek(e.clientX)}
      onKeyDown={(e) => {
        const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
        if (!dir) return;
        e.preventDefault();
        onSeek(view.start + view.len / 2 + dir * view.len);
      }}
      className="relative h-7 shrink-0 cursor-pointer touch-none select-none overflow-hidden border-t border-border bg-bg outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
    >
      {labels.filter((_, i) => i % step === 0).map((l) => (
        <span key={l.pos} aria-hidden className="absolute top-1.5 border-l border-border pl-1 font-mono text-[10px] text-muted" style={{ left: pct(l.pos) }}>
          {l.label}
        </span>
      ))}
      <span aria-hidden className="absolute inset-y-0 w-0.5 bg-danger" style={{ left: pct(now) }} />
      <span aria-hidden className="absolute inset-y-0.5 rounded border-2 border-accent bg-accent-soft/40" style={{ left: pct(view.start), width: `max(6px, ${pct(view.len)})` }} />
    </div>
  );
}

