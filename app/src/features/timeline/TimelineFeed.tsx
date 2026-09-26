import { useEffect, useRef, useState, type TouchEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { placedBetween, type Placed } from '@/data/agenda';
import type { Group, LocalDate } from '@/data/types';
import { Button } from '@/design/Button';
import { cn } from '@/design/cn';
import { addDays, formatDay, spanDays, todayLocal, weekday } from '@/lib/time';
import { AgendaItemRow } from '@/features/time/AgendaRow';
import { laneKeysFor, type Lane } from './layout';
import { useTimeline } from './store';

/**
 * The phone timeline (TIME-10): a journal-style feed of days, newest at the bottom, with lane
 * filter chips. Swipe left or right to move between lanes.
 */
export function TimelineFeed({ lanes, groups }: { lanes: Lane[]; groups: Map<string, Group> }) {
  const { laneMode, undated } = useTimeline();
  const today = todayLocal();
  const [range, setRange] = useState({ from: addDays(today, -3), to: addDays(today, 21) });
  const [lane, setLane] = useState<string>('all');
  const touch = useRef<{ x: number; y: number } | null>(null);
  const todayRef = useRef<HTMLElement>(null);
  const placed = useLiveQuery(() => placedBetween(range.from, range.to, { undated }), [range.from, range.to, undated]);

  const ready = placed !== undefined;
  useEffect(() => {
    if (ready) todayRef.current?.scrollIntoView({ block: 'start' });
  }, [ready]);

  const chips = [{ key: 'all', label: 'All' }, ...lanes];
  const shown = (placed ?? []).filter((p) => lane === 'all' || laneKeysFor(p.item, laneMode).includes(lane));
  // Each entry is listed on its first day in range (a multi-day span says when it ends).
  const byDay = new Map<LocalDate, Placed[]>();
  for (const p of shown) {
    const first = spanDays(p.span)[0];
    const day = first < range.from ? range.from : first;
    byDay.set(day, [...(byDay.get(day) ?? []), p]);
  }
  if (!byDay.has(today)) byDay.set(today, []);
  const days = [...byDay.keys()].sort();

  const swipe = (dir: 1 | -1) => {
    const i = chips.findIndex((c) => c.key === lane);
    const next = chips[(i + dir + chips.length) % chips.length]!;
    setLane(next.key);
  };
  const onTouchStart = (e: TouchEvent) => (touch.current = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY });
  const onTouchEnd = (e: TouchEvent) => {
    const s = touch.current;
    touch.current = null;
    if (!s) return;
    const dx = e.changedTouches[0]!.clientX - s.x;
    const dy = e.changedTouches[0]!.clientY - s.y;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 2) swipe(dx < 0 ? 1 : -1);
  };

  return (
    <>
      <div role="group" aria-label="Show lane" className="flex flex-wrap gap-1.5 border-b border-border px-4 py-2">
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            aria-pressed={lane === c.key}
            onClick={() => setLane(c.key)}
            className={cn('rounded-full border border-border px-3 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-focus', lane === c.key ? 'border-accent bg-accent-soft font-medium text-accent' : 'text-muted')}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="flex justify-center py-2">
          <Button size="sm" variant="ghost" onPress={() => setRange((r) => ({ ...r, from: addDays(r.from, -14) }))}>
            <ChevronUp size={15} aria-hidden /> Earlier
          </Button>
        </div>
        {days.map((day) => {
          const entries = byDay.get(day)!;
          const isToday = day === today;
          const wd = weekday(day);
          return (
            <section key={day} ref={isToday ? todayRef : undefined} aria-label={formatDay(day)} className="scroll-mt-2">
              <h2 className={cn('sticky top-0 z-10 flex items-baseline gap-2 bg-surface px-2 py-1.5 text-sm font-semibold', isToday && 'text-accent', (wd === 0 || wd === 6) && !isToday && 'text-muted')}>
                {formatDay(day)}
                {isToday && <span className="text-xs font-normal text-muted">{new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(new Date())}</span>}
              </h2>
              {entries.length ? (
                <ul>
                  {entries.map((p) => (
                    <AgendaItemRow key={`${p.item.id}@${p.span.start}`} entry={p} groups={groups} />
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-2 text-sm text-muted">Nothing planned.</p>
              )}
            </section>
          );
        })}
        <div className="flex justify-center py-2">
          <Button size="sm" variant="ghost" onPress={() => setRange((r) => ({ ...r, to: addDays(r.to, 28) }))}>
            <ChevronDown size={15} aria-hidden /> Later
          </Button>
        </div>
      </div>
    </>
  );
}
