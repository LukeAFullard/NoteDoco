import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { placedBetween } from '@/data/agenda';
import { usePrefs } from '@/app/prefs';
import { useUi } from '@/app/ui';
import { cn } from '@/design/cn';
import { useLocalPref } from '@/lib/localPref';
import { addMonths, firstDayOfWeek, formatLongDay, fromLocalDate, startOfMonth, todayLocal } from '@/lib/time';
import { byDay, monthGrid } from './grid';

/** The sidebar's month (TIME-11): a dot under days with something on; click a day to see its week. */
export function MiniCalendar() {
  const today = todayLocal();
  const [month, setMonth] = useState(startOfMonth(today));
  const weekStart = firstDayOfWeek(usePrefs((p) => p.weekStart));
  const days = monthGrid(month, weekStart);
  const navigate = useNavigate();
  const [open, setOpen] = useLocalPref('miniCalendar', true);
  const counts = useLiveQuery(async () => {
    const m = byDay(await placedBetween(days[0]!, days[41]!), days);
    return new Map([...m].map(([d, list]) => [d, list.length]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days[0]]);
  const label = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(fromLocalDate(month));
  const dayNames = days.slice(0, 7).map((d) => new Intl.DateTimeFormat(undefined, { weekday: 'narrow' }).format(fromLocalDate(d)));

  return (
    <section aria-label="Month" className="px-1 text-xs">
      <div className="flex items-center justify-between px-1.5 pb-1">
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex items-center gap-1 rounded font-medium outline-none focus-visible:ring-2 focus-visible:ring-focus">
          <ChevronDown size={13} aria-hidden className={cn('text-muted transition-transform', !open && '-rotate-90')} />
          {label}
        </button>
        <span className={cn('flex', !open && 'hidden')}>
          <button type="button" aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))} className="flex h-6 w-6 items-center justify-center rounded text-muted hover:text-text focus-visible:ring-2 focus-visible:ring-focus">
            <ChevronLeft size={14} />
          </button>
          <button type="button" aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))} className="flex h-6 w-6 items-center justify-center rounded text-muted hover:text-text focus-visible:ring-2 focus-visible:ring-focus">
            <ChevronRight size={14} />
          </button>
        </span>
      </div>
      <div hidden={!open}>
        <div className="grid grid-cols-7 text-center text-[10px] text-muted" aria-hidden>
          {dayNames.map((n, i) => (
            <span key={i}>{n}</span>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d) => {
            const n = counts?.get(d) ?? 0;
            return (
              <button
                key={d}
                type="button"
                onClick={() => {
                  useUi.setState({ drawerOpen: false });
                  navigate(`/calendar?view=week&date=${d}`);
                }}
                aria-label={`${formatLongDay(d)}${n ? `, ${n} ${n === 1 ? 'item' : 'items'}` : ''}`}
                className={cn(
                  'relative mx-auto flex h-7 w-7 items-center justify-center rounded-full outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-focus',
                  d.slice(0, 7) !== month.slice(0, 7) && 'text-muted',
                  d === today && 'bg-accent-fill font-bold text-on-accent hover:bg-accent-fill',
                )}
              >
                {Number(d.slice(8))}
                {n > 0 && <span aria-hidden className={cn('absolute bottom-0.5 h-1 w-1 rounded-full', d === today ? 'bg-on-accent' : 'bg-accent')} />}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
