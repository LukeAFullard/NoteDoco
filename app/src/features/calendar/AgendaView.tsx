import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronDown } from 'lucide-react';
import { placedKey, placedBetween, taskLines, type Placed, type TaskLine } from '@/data/agenda';
import type { LocalDate } from '@/data/types';
import { Button } from '@/design/Button';
import { cn } from '@/design/cn';
import { addDays, formatDay, formatLongDay, spanDays, todayLocal } from '@/lib/time';
import { AgendaItemRow, TaskLineRow } from '@/features/time/AgendaRow';
import type { CalendarViewProps } from './MonthView';

/** Agenda (TIME-11): the days ahead as a list, including dated checklist lines. */
export function AgendaView({ anchor, groups, onCreate }: Pick<CalendarViewProps, 'anchor' | 'groups' | 'onCreate'>) {
  const [length, setLength] = useState(30);
  const to = addDays(anchor, length);
  const data = useLiveQuery(async () => {
    const [placed, lines] = await Promise.all([placedBetween(anchor, to), taskLines({ from: anchor, to })]);
    return { placed, lines };
  }, [anchor, to]);
  const today = todayLocal();
  const days = new Map<LocalDate, { placed: Placed[]; lines: TaskLine[] }>();
  const bucket = (d: LocalDate) => {
    if (!days.has(d)) days.set(d, { placed: [], lines: [] });
    return days.get(d)!;
  };
  for (const p of data?.placed ?? []) {
    const first = spanDays(p.span)[0];
    bucket(first < anchor ? anchor : first).placed.push(p);
  }
  for (const l of data?.lines ?? []) bucket(l.day!).lines.push(l);
  const sorted = [...days.keys()].sort();

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-2 py-3">
        {data && !sorted.length && (
          <div className="px-2 py-8 text-center text-sm text-muted">
            <p>Nothing planned from {formatLongDay(anchor)} to {formatLongDay(to)}.</p>
            <Button className="mt-3" size="sm" onPress={() => onCreate(anchor, null)}>
              Add a sticky on {formatDay(anchor)}
            </Button>
          </div>
        )}
        {sorted.map((d) => {
          const { placed, lines } = days.get(d)!;
          return (
            <section key={d} aria-label={formatLongDay(d)} className="mb-3">
              <h2 className={cn('sticky top-0 z-10 bg-surface px-2 py-1.5 text-sm font-semibold', d === today && 'text-accent')}>
                {formatLongDay(d)}
                {['Today', 'Tomorrow'].includes(formatDay(d)) && <span className="ml-2 text-xs font-normal text-muted">{formatDay(d)}</span>}
              </h2>
              <ul>
                {placed.map((p) => (
                  <AgendaItemRow key={placedKey(p)} entry={p} groups={groups} />
                ))}
                {lines.map((l) => (
                  <TaskLineRow key={l.ref.id} line={l} groups={groups} />
                ))}
              </ul>
            </section>
          );
        })}
        {data && (
          <div className="flex justify-center py-2">
            <Button size="sm" variant="ghost" onPress={() => setLength((n) => n + 30)}>
              <ChevronDown size={15} aria-hidden /> Show 30 more days
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
