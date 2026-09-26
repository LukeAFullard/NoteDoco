import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Pane } from '@/app/Pane';
import { setCurrentGroup } from '@/app/ui';
import { usePrefs } from '@/app/prefs';
import { toastWithUndo } from '@/app/undoActions';
import { Button, IconButton } from '@/design/Button';
import { cn } from '@/design/cn';
import { placedBetween, type Placed } from '@/data/agenda';
import { dateItemsWithUndo, rescheduleWithUndo } from '@/data/actions';
import { useGroups } from '@/data/hooks';
import { createItem } from '@/data/repos/items';
import type { Group, Item, LocalDate, TimeSpan } from '@/data/types';
import { useLocalPref } from '@/lib/localPref';
import { addDays, addMonths, allDaySpan, diffDays, firstDayOfWeek, fromLocalDate, isLocalDate, shiftSpan, spanEnd, spanStart, timedSpan, todayLocal } from '@/lib/time';
import { openSticky } from '@/features/stickies/stickyDialog';
import { monthGrid, weekDays } from './grid';
import { MonthView } from './MonthView';
import { WeekView } from './WeekView';
import { AgendaView } from './AgendaView';
import { useCalendarDrag, type CalendarDragStart, type CalendarDrop } from './useCalendarDrag';

type View = 'month' | 'week' | 'agenda';
const VIEWS: { value: View; label: string }[] = [
  { value: 'month', label: 'Month' },
  { value: 'week', label: 'Week' },
  { value: 'agenda', label: 'Agenda' },
];

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

const atMinutes = (day: LocalDate, minutes: number) => {
  const d = fromLocalDate(day);
  d.setHours(0, Math.max(0, Math.min(24 * 60 - 15, minutes)), 0, 0);
  return d;
};
const snap = (m: number) => Math.round(m / 15) * 15;
const NONE: Placed[] = [];

/** Calendar (TIME-11): month, week and agenda, sharing the timeline's queries and undo. */
export function CalendarPage() {
  const [params, setParams] = useSearchParams();
  const [savedView, setSavedView] = useLocalPref<View>('calendarView', 'month');
  const narrow = useIsNarrow();
  const requested = (params.get('view') as View | null) ?? savedView;
  const view: View = narrow && requested === 'week' ? 'month' : requested;
  const dateParam = params.get('date');
  const anchor = dateParam && isLocalDate(dateParam) ? dateParam : todayLocal();
  const weekStart = firstDayOfWeek(usePrefs((p) => p.weekStart));
  const groups = new Map((useGroups() ?? []).map((g) => [g.id, g] as [string, Group]));
  const navigate = useNavigate();
  const container = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<string | null>(null);
  useEffect(() => setCurrentGroup(null), []);

  const range = view === 'month' ? monthGrid(anchor, weekStart) : weekDays(anchor, weekStart);
  const loaded = useLiveQuery(() => (view === 'agenda' ? Promise.resolve([]) : placedBetween(range[0]!, range.at(-1)!)), [view, range[0]]);
  const placed = loaded ?? NONE;

  // After a keyboard move the entry is re-drawn; put focus back on it.
  useEffect(() => {
    const id = pendingFocus.current;
    if (!id) return;
    const el = container.current?.querySelector<HTMLElement>(`[data-item-id="${CSS.escape(id)}"]`);
    if (el) {
      pendingFocus.current = null;
      el.focus();
    }
  }, [loaded]);

  const go = (patch: { view?: View; date?: LocalDate }) => {
    const next = new URLSearchParams(params);
    if (patch.view) {
      next.set('view', patch.view);
      setSavedView(patch.view);
    }
    if (patch.date) next.set('date', patch.date);
    setParams(next, { replace: true });
  };
  const step = (dir: 1 | -1) => go({ date: view === 'month' ? addMonths(anchor, dir) : addDays(anchor, dir * 7) });

  const open = (item: Item) => (item.kind === 'sticky' ? openSticky(item.id) : navigate(`/items/${item.id}`));

  const reschedule = async (p: Placed, next: TimeSpan) => {
    if (JSON.stringify(next) === JSON.stringify(p.span)) return;
    toastWithUndo(await rescheduleWithUndo(p.item, p.basis, p.span, next));
  };

  const onDrop = async ({ placed: p, fromDay, kind, grabMinutes }: CalendarDragStart, to: CalendarDrop) => {
    if (to.minutes === null) return reschedule(p, shiftSpan(p.span, diffDays(fromDay, to.day)));
    if (kind === 'end' && !p.span.allDay) {
      const end = atMinutes(to.day, snap(to.minutes));
      if (end <= spanStart(p.span)) return;
      return reschedule(p, { ...p.span, end: end.toISOString() });
    }
    const start = atMinutes(to.day, snap(to.minutes - grabMinutes));
    if (p.span.allDay) return reschedule(p, timedSpan(start, new Date(start.getTime() + 60 * 60_000)));
    const length = spanEnd(p.span).getTime() - spanStart(p.span).getTime();
    return reschedule(p, { ...p.span, start: start.toISOString(), end: p.span.end ? new Date(start.getTime() + length).toISOString() : null });
  };
  const drag = useCalendarDrag((s, to) => void onDrop(s, to));

  const onKeyMove = (p: Placed, days: number, minutes = 0) => {
    pendingFocus.current = p.item.id;
    if (minutes && !p.span.allDay) {
      const ms = minutes * 60_000;
      void reschedule(p, { ...p.span, start: new Date(Date.parse(p.span.start) + ms).toISOString(), end: p.span.end ? new Date(Date.parse(p.span.end) + ms).toISOString() : null });
    } else if (days) void reschedule(p, shiftSpan(p.span, days));
  };

  const onCreate = async (day: LocalDate, minutes: number | null) => {
    const when = minutes === null ? allDaySpan(day) : timedSpan(atMinutes(day, minutes), atMinutes(day, minutes + 60));
    const id = await createItem({ kind: 'sticky', when });
    openSticky(id, true);
  };

  const onKey = (e: KeyboardEvent) => {
    const el = e.target as HTMLElement;
    if (el.closest('input, textarea, select, [contenteditable="true"]') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 't' || e.key === 'T') go({ date: todayLocal() });
    else if (e.key === 'PageDown' || e.key === 'n') step(1);
    else if (e.key === 'PageUp' || e.key === 'p') step(-1);
    else return;
    e.preventDefault();
  };

  const title =
    view === 'month'
      ? new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(fromLocalDate(anchor))
      : view === 'week'
        ? `${new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(fromLocalDate(range[0]!))} – ${new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(fromLocalDate(range[6]!))}`
        : `From ${new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' }).format(fromLocalDate(anchor))}`;

  const props = {
    anchor,
    weekStart,
    placed,
    groups,
    open,
    drag,
    onKeyMove,
    onCreate: (d: LocalDate, m: number | null) => void onCreate(d, m),
    onPickDay: (d: LocalDate) => go({ view: view === 'month' && !narrow ? 'week' : 'agenda', date: d }),
    onDropItems: async (ids: string[], d: LocalDate) => toastWithUndo(await dateItemsWithUndo(ids, d)),
    narrow,
  };

  return (
    <Pane
      title="Calendar"
      actions={
        <Button size="sm" onPress={() => go({ date: todayLocal() })}>
          Today
        </Button>
      }
    >
      <div ref={container} className="flex h-full min-h-0 flex-col" onKeyDown={onKey}>
        <p id="calendar-help" className="sr-only">
          Alt with the arrow keys moves an item to another day{view === 'week' ? '; Alt with up and down arrows moves a timed item by 15 minutes' : ''}.
        </p>
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
          <div className="flex items-center">
            <IconButton label={`Previous ${view === 'month' ? 'month' : 'week'}`} size="sm" onPress={() => step(-1)}>
              <ChevronLeft size={16} />
            </IconButton>
            <IconButton label={`Next ${view === 'month' ? 'month' : 'week'}`} size="sm" onPress={() => step(1)}>
              <ChevronRight size={16} />
            </IconButton>
          </div>
          <h2 aria-live="polite" className="min-w-0 flex-1 truncate font-semibold">
            {title}
          </h2>
          <div role="radiogroup" aria-label="Calendar view" className="flex rounded-panel border border-border p-0.5 text-sm">
            {VIEWS.filter((v) => !(narrow && v.value === 'week')).map((v) => (
              <button
                key={v.value}
                type="button"
                role="radio"
                aria-checked={view === v.value}
                onClick={() => go({ view: v.value })}
                className={cn('rounded px-2.5 py-1 outline-none focus-visible:ring-2 focus-visible:ring-focus', view === v.value ? 'bg-accent-soft font-medium text-accent' : 'text-muted')}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
        {view === 'month' && <MonthView {...props} />}
        {view === 'week' && <WeekView {...props} />}
        {view === 'agenda' && <AgendaView anchor={anchor} groups={groups} onCreate={props.onCreate} />}
      </div>
      {drag.dragging && (
        <div aria-hidden className="pointer-events-none fixed z-50 max-w-48 truncate rounded bg-accent-fill px-2 py-1 text-xs font-medium text-on-accent shadow-lg" style={{ left: drag.dragging.x + 12, top: drag.dragging.y + 8 }}>
          {drag.dragging.placed.item.title || 'Untitled'}
        </div>
      )}
    </Pane>
  );
}
