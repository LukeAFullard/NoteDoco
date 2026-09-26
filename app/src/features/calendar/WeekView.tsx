import { useEffect, useRef, useState } from 'react';
import { cn } from '@/design/cn';
import { formatLongDay, formatSpanTime, formatTime, todayLocal } from '@/lib/time';
import { itemTitle } from '@/features/items/kinds';
import { packLane, type Entry } from '@/features/timeline/layout';
import { byDay, dayExtent, weekDays } from './grid';
import { CalendarChip } from './CalendarChip';
import { keyMoveHandler } from './keys';
import type { CalendarViewProps } from './MonthView';

const HOUR = 48;
const PER_MIN = HOUR / 60;
const TIME_COL = 56;

function useNowMinute() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/** Week (TIME-11): an all-day row and a time grid; drag to move or to change the end. */
export function WeekView({ anchor, weekStart, placed, open, drag, onKeyMove, onCreate, onPickDay }: CalendarViewProps) {
  const days = weekDays(anchor, weekStart);
  const today = todayLocal();
  const now = useNowMinute();
  const grid = useRef<HTMLDivElement>(null);
  const allDay = byDay(placed.filter((p) => p.span.allDay || p.basis === 'due'), days);
  const timed = byDay(placed.filter((p) => !p.span.allDay && p.basis !== 'due'), days);
  const hours = Array.from({ length: 24 }, (_, h) => h);

  // Start scrolled to the working day (or an hour before now).
  useEffect(() => {
    const h = days.includes(today) ? Math.max(0, Math.min(now.getHours() - 2, 14)) : 7;
    grid.current?.scrollTo({ top: h * HOUR });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor]);

  const dragged = drag.dragging;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex border-b border-border">
        <div style={{ width: TIME_COL }} className="shrink-0" />
        {days.map((d) => (
          <div key={d} className="min-w-0 flex-1 border-l border-border px-1 py-1 text-center">
            <button
              type="button"
              onClick={() => onPickDay(d)}
              aria-label={`${formatLongDay(d)}: show in the agenda`}
              className={cn('rounded px-1.5 text-sm outline-none hover:bg-accent-soft focus-visible:ring-2 focus-visible:ring-focus', d === today && 'font-bold text-accent')}
            >
              {new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(new Date(`${d}T12:00`))} {Number(d.slice(8))}
            </button>
          </div>
        ))}
      </div>
      <div className="flex max-h-32 overflow-y-auto border-b border-border">
        <div style={{ width: TIME_COL }} className="shrink-0 px-1 py-1 text-right text-[11px] text-muted">
          All day
        </div>
        {days.map((d) => (
          <div key={d} data-cal-day={d} onDoubleClick={(e) => e.target === e.currentTarget && onCreate(d, null)} className="flex min-h-9 min-w-0 flex-1 flex-col gap-0.5 border-l border-border p-0.5">
            {allDay.get(d)!.map((p) => (
              <CalendarChip
                key={`${p.item.id}@${p.span.start}`}
                placed={p}
                showTime={false}
                onOpen={() => !drag.justDragged() && open(p.item)}
                dimmed={dragged?.placed === p}
                onPointerDown={(e) => drag.start(e, { placed: p, fromDay: d, kind: 'move', grabMinutes: 0 })}
                onKeyDown={keyMoveHandler(p, onKeyMove, 7)}
              />
            ))}
          </div>
        ))}
      </div>
      <div ref={grid} tabIndex={0} role="region" aria-label="Times of day" className="relative min-h-0 flex-1 overflow-y-auto outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus">
        <div className="relative flex" style={{ height: 24 * HOUR }}>
          <div style={{ width: TIME_COL }} className="relative shrink-0" aria-hidden>
            {hours.slice(1).map((h) => (
              <span key={h} className="absolute right-1.5 -translate-y-1/2 font-mono text-[11px] text-muted" style={{ top: h * HOUR }}>
                {formatTime(new Date(2026, 0, 1, h)).replace(':00', '')}
              </span>
            ))}
          </div>
          {days.map((d) => {
            const entries: Entry[] = timed.get(d)!.map((p) => {
              const [a, b] = dayExtent(p.span, d);
              return { key: `${p.item.id}@${p.span.start}`, placed: p, lane: d, a, b };
            });
            const packed = packLane(entries, 4, 0, 30);
            const cols = Math.max(1, packed.rows - (packed.clusters.length ? 1 : 0));
            return (
              <div
                key={d}
                data-cal-day={d}
                data-cal-px-per-min={PER_MIN}
                aria-label={formatLongDay(d)}
                role="group"
                onDoubleClick={(e) => {
                  if (e.target !== e.currentTarget) return;
                  const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
                  onCreate(d, Math.floor(y / PER_MIN / 30) * 30);
                }}
                className={cn('relative min-w-0 flex-1 border-l border-border', d === today && 'bg-accent-soft/20')}
                style={{ backgroundImage: `repeating-linear-gradient(to bottom, var(--color-border) 0 1px, transparent 1px ${HOUR}px)` }}
              >
                {packed.entries.map((e) => {
                  const p = e.placed;
                  const sticky = p.item.kind === 'sticky';
                  const colour = p.item.colour ?? (sticky ? 'lemon' : null);
                  return (
                    <div
                      key={e.key}
                      className={cn('absolute overflow-hidden rounded border text-xs', sticky ? 'border-black/10 text-sticky-ink' : 'border-border bg-surface-2', dragged?.placed === p && 'opacity-30', p.projected && 'border-dashed opacity-80')}
                      style={{ top: e.a * PER_MIN, height: Math.max(18, (e.b - e.a) * PER_MIN - 2), left: `${(e.row / cols) * 100}%`, width: `calc(${100 / cols}% - 3px)`, ...(sticky && colour ? { background: `var(--sticky-${colour})` } : {}) }}
                    >
                      <button
                        type="button"
                        data-item-id={p.item.id}
                        onClick={() => !drag.justDragged() && open(p.item)}
                        onPointerDown={(ev) => {
                          const rect = ev.currentTarget.getBoundingClientRect();
                          drag.start(ev, { placed: p, fromDay: d, kind: 'move', grabMinutes: (ev.clientY - rect.top) / PER_MIN });
                        }}
                        onKeyDown={(ev) => {
                          if (ev.altKey && (ev.key === 'ArrowUp' || ev.key === 'ArrowDown')) {
                            ev.preventDefault();
                            onKeyMove(p, 0, ev.key === 'ArrowDown' ? 15 : -15);
                          } else keyMoveHandler(p, onKeyMove, 7)(ev);
                        }}
                        aria-label={`${itemTitle(p.item.title, p.item.kind)}, ${formatSpanTime(p.span)}${p.projected ? ', upcoming repeat' : ''}`}
                        aria-describedby="calendar-help"
                        className="flex h-full w-full select-none flex-col items-start px-1 py-0.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
                      >
                        <span className={cn('w-full truncate font-medium', p.item.task?.done && !p.projected && 'line-through opacity-60')}>{itemTitle(p.item.title, p.item.kind)}</span>
                        <span className="truncate opacity-80">{formatSpanTime(p.span)}</span>
                      </button>
                      {!p.projected && (
                        <span
                          aria-hidden
                          className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize"
                          onPointerDown={(ev) => drag.start(ev, { placed: p, fromDay: d, kind: 'end', grabMinutes: 0 })}
                        />
                      )}
                    </div>
                  );
                })}
                {packed.clusters.map((c) => (
                  <button
                    key={c.pos}
                    type="button"
                    onClick={() => onPickDay(d)}
                    className="absolute right-0.5 rounded-full bg-surface px-1.5 text-[11px] text-muted shadow outline-none focus-visible:ring-2 focus-visible:ring-focus"
                    style={{ top: c.pos * PER_MIN }}
                  >
                    +{c.count}
                  </button>
                ))}
                {d === today && (
                  <div aria-hidden className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-danger" style={{ top: (now.getHours() * 60 + now.getMinutes()) * PER_MIN }} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
