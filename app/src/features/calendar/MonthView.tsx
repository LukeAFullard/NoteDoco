import { useState } from 'react';
import { Plus } from 'lucide-react';
import { placedKey, type Placed } from '@/data/agenda';
import type { Group, Item, LocalDate } from '@/data/types';
import { cn } from '@/design/cn';
import { formatLongDay, todayLocal } from '@/lib/time';
import { AgendaItemRow } from '@/features/time/AgendaRow';
import { byDay, monthGrid } from './grid';
import { CalendarChip } from './CalendarChip';
import type { useCalendarDrag } from './useCalendarDrag';
import { keyMoveHandler } from './keys';
import { ItemDropZone } from '@/features/items/DropZone';

export interface CalendarViewProps {
  anchor: LocalDate;
  weekStart: 0 | 1;
  placed: Placed[];
  groups: Map<string, Group>;
  open: (item: Item) => void;
  drag: ReturnType<typeof useCalendarDrag>;
  /** Alt+arrow keys: move by days (and minutes in the week grid). */
  onKeyMove: (p: Placed, days: number, minutes?: number) => void;
  onCreate: (day: LocalDate, minutes: number | null) => void;
  onPickDay: (day: LocalDate) => void;
  /** Items dragged in from a list or another pane (WS-2). */
  onDropItems: (ids: string[], day: LocalDate) => void;
  narrow: boolean;
}

const MAX_CHIPS = 4;
const dayName = (d: LocalDate, style: 'short' | 'narrow') => new Intl.DateTimeFormat(undefined, { weekday: style }).format(new Date(`${d}T12:00`));

/** Month (TIME-11): six weeks of days; on phones, dots per day and the chosen day's list below. */
export function MonthView({ anchor, weekStart, placed, groups, open, drag, onKeyMove, onCreate, onPickDay, onDropItems, narrow }: CalendarViewProps) {
  const days = monthGrid(anchor, weekStart);
  const entries = byDay(placed, days);
  const month = anchor.slice(0, 7);
  const today = todayLocal();
  const [selected, setSelected] = useState<LocalDate>(anchor.slice(0, 7) === today.slice(0, 7) ? today : anchor);
  const weeks = Array.from({ length: 6 }, (_, i) => days.slice(i * 7, i * 7 + 7));

  if (narrow) {
    const list = entries.get(selected) ?? [];
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid grid-cols-7 px-2 pt-2 text-center text-xs text-muted" aria-hidden>
          {days.slice(0, 7).map((d) => (
            <span key={d}>{dayName(d, 'narrow')}</span>
          ))}
        </div>
        <div role="group" aria-label="Days" className="grid grid-cols-7 gap-y-1 px-2 py-1">
          {days.map((d) => {
            const n = entries.get(d)!.length;
            return (
              <button
                key={d}
                type="button"
                aria-pressed={d === selected}
                aria-label={`${formatLongDay(d)}${n ? `, ${n} ${n === 1 ? 'item' : 'items'}` : ''}`}
                onClick={() => setSelected(d)}
                className={cn(
                  'mx-auto flex h-11 w-11 flex-col items-center justify-center rounded-full text-sm outline-none focus-visible:ring-2 focus-visible:ring-focus',
                  d.slice(0, 7) !== month && 'text-muted',
                  d === today && 'font-bold text-accent',
                  d === selected && 'bg-accent-soft',
                )}
              >
                {Number(d.slice(8))}
                <span aria-hidden className={cn('mt-0.5 h-1 w-1 rounded-full', n ? 'bg-accent' : 'bg-transparent')} />
              </button>
            );
          })}
        </div>
        <section aria-label={formatLongDay(selected)} className="border-t border-border px-2 py-2">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-sm font-semibold">{formatLongDay(selected)}</h2>
            <button type="button" onClick={() => onCreate(selected, null)} className="flex items-center gap-1 rounded px-2 py-1 text-sm text-accent outline-none focus-visible:ring-2 focus-visible:ring-focus">
              <Plus size={14} aria-hidden /> Add
            </button>
          </div>
          {list.length ? (
            <ul>
              {list.map((p) => (
                <AgendaItemRow key={placedKey(p)} entry={p} groups={groups} />
              ))}
            </ul>
          ) : (
            <p className="px-2 py-3 text-sm text-muted">Nothing on this day.</p>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="grid grid-cols-7 border-b border-border text-xs font-medium text-muted" aria-hidden>
        {days.slice(0, 7).map((d) => (
          <div key={d} className="px-2 py-1.5">
            {dayName(d, 'short')}
          </div>
        ))}
      </div>
      <div className="grid flex-1 auto-rows-[minmax(7rem,1fr)]">
        {weeks.map((week) => (
          <div key={week[0]} className="grid grid-cols-7 border-b border-border">
            {week.map((d) => {
              const list = entries.get(d)!;
              const more = list.length - MAX_CHIPS;
              return (
                <ItemDropZone
                  key={d}
                  role="group"
                  onDropItems={(ids) => onDropItems(ids, d)}
                  data-cal-day={d}
                  aria-label={formatLongDay(d)}
                  onDoubleClick={(e) => e.target === e.currentTarget && onCreate(d, null)}
                  className={cn('group/day relative flex min-w-0 flex-col gap-0.5 border-r border-border p-1', d.slice(0, 7) !== month && 'bg-surface-2/40')}
                >
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => onPickDay(d)}
                      aria-label={`Show the week of ${formatLongDay(d)}`}
                      className={cn(
                        'flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs outline-none hover:bg-accent-soft focus-visible:ring-2 focus-visible:ring-focus',
                        d === today ? 'bg-accent-fill font-bold text-on-accent' : d.slice(0, 7) !== month ? 'text-muted' : 'font-medium',
                      )}
                    >
                      {Number(d.slice(8))}
                    </button>
                    <button
                      type="button"
                      onClick={() => onCreate(d, null)}
                      aria-label={`Add a sticky on ${formatLongDay(d)}`}
                      className="flex h-6 w-6 items-center justify-center rounded text-muted opacity-0 outline-none hover:text-accent focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-focus group-hover/day:opacity-100"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                  {list.slice(0, MAX_CHIPS).map((p) => (
                    <CalendarChip
                      key={placedKey(p)}
                      placed={p}
                      onOpen={() => !drag.justDragged() && open(p.item)}
                      dimmed={drag.dragging?.placed === p}
                      onPointerDown={(e) => drag.start(e, { placed: p, fromDay: d, kind: 'move', grabMinutes: 0 })}
                      onKeyDown={keyMoveHandler(p, onKeyMove, 7)}
                    />
                  ))}
                  {more > 0 && (
                    <button type="button" onClick={() => onPickDay(d)} className="rounded px-1 text-left text-xs text-muted outline-none hover:text-text focus-visible:ring-2 focus-visible:ring-focus">
                      +{more} more
                    </button>
                  )}
                </ItemDropZone>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
