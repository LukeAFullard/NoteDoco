import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarCheck2, NotebookPen, Pin } from 'lucide-react';
import { Pane } from '@/app/Pane';
import { setCurrentGroup } from '@/app/ui';
import { Button } from '@/design/Button';
import { db } from '@/data/db';
import { useGroups } from '@/data/hooks';
import { overdueItems, placedBetween, taskLines, type Placed } from '@/data/agenda';
import { dailyPage } from '@/data/repos/daily';
import { dateItemsWithUndo } from '@/data/actions';
import { toastWithUndo } from '@/app/undoActions';
import { ItemDropZone } from '@/features/items/DropZone';
import type { Group } from '@/data/types';
import { addDays, formatDay, formatLongDay, todayLocal } from '@/lib/time';
import { CaptureBar } from '@/features/capture/CaptureBar';
import { ItemCollection } from '@/features/items/ItemCollection';
import { AgendaItemRow, ItemLink, TaskLineRow } from '@/features/time/AgendaRow';
import { useToday } from '@/features/time/useToday';

const UPCOMING_DAYS = 7;

function Heading({ children, count }: { children: string; count?: number }) {
  return (
    <h2 className="mb-1 flex items-baseline gap-2 px-2 text-sm font-semibold uppercase tracking-wide text-muted">
      {children}
      {count !== undefined && count > 0 && <span className="font-mono text-xs font-normal">{count}</span>}
    </h2>
  );
}

/** Today (TIME-2): what's due and planned, today's page, quick capture and pinned stickies. */
export function TodayPage() {
  const today = useToday();
  const navigate = useNavigate();
  useEffect(() => setCurrentGroup(null), []);
  const groups = new Map((useGroups() ?? []).map((g) => [g.id, g] as [string, Group]));

  const data = useLiveQuery(async () => {
    const [overdue, placedToday, linesToday, upcoming, pinned, recent] = await Promise.all([
      overdueItems(),
      placedBetween(today, today),
      taskLines({ from: today, to: today }),
      placedBetween(addDays(today, 1), addDays(today, UPCOMING_DAYS)),
      db.items.where('kind').equals('sticky').filter((i) => i.pinned && !i.deletedAt && !i.archived).toArray(),
      db.items.orderBy('updatedAt').reverse().filter((i) => !i.deletedAt && !i.archived).limit(5).toArray(),
    ]);
    const overdueIds = new Set(overdue.map((i) => i.id));
    return {
      overdue,
      // Overdue items are listed once, under Overdue.
      today: placedToday.filter((p) => !overdueIds.has(p.item.id) || p.projected),
      linesToday,
      upcoming,
      pinned,
      recent,
    };
  }, [today]);

  const openDaily = async () => navigate(`/items/${await dailyPage(today)}`);
  const byDay = new Map<string, Placed[]>();
  // Repeats show their next occurrence only, so a daily habit doesn't fill the week.
  const shownRepeat = new Set<string>();
  for (const p of data?.upcoming ?? []) {
    if (p.item.recurrence) {
      if (shownRepeat.has(p.item.id) || (data?.today ?? []).some((t) => t.item.id === p.item.id)) continue;
      shownRepeat.add(p.item.id);
    }
    const day = p.span.allDay ? p.span.start : todayLocal(new Date(p.span.start));
    const key = day < addDays(today, 1) ? addDays(today, 1) : day;
    byDay.set(key, [...(byDay.get(key) ?? []), p]);
  }
  const nothingToday = data && !data.overdue.length && !data.today.length && !data.linesToday.length;

  return (
    <Pane
      title="Today"
      actions={
        <Button size="sm" variant="secondary" onPress={() => void openDaily()}>
          <NotebookPen size={15} aria-hidden /> Today’s page
        </Button>
      }
    >
      <div className="mx-auto grid max-w-5xl gap-6 p-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:p-6">
        <div className="min-w-0 space-y-6">
          <div>
            <p className="mb-3 text-2xl font-semibold">{formatLongDay(today)}</p>
            <CaptureBar defaultDay={today} placeholder="Add to today… try “call Sam 3pm” or “pay rent by fri”" />
          </div>

          {data && data.overdue.length > 0 && (
            <section aria-label="Overdue">
              <Heading count={data.overdue.length}>Overdue</Heading>
              <ul>
                {data.overdue.map((item) => (
                  <AgendaItemRow key={item.id} entry={{ item, span: (item.due ?? item.when)!, projected: false, basis: item.due ? 'due' : 'when' }} groups={groups} showDate time={false} />
                ))}
              </ul>
            </section>
          )}

          <ItemDropZone role="region" aria-label="Today’s plan" className="rounded-panel" onDropItems={async (ids) => toastWithUndo(await dateItemsWithUndo(ids, today))}>
            <Heading count={(data?.today.length ?? 0) + (data?.linesToday.length ?? 0)}>Today</Heading>
            {nothingToday ? (
              <div className="flex items-start gap-3 rounded-panel border border-dashed border-border px-4 py-5 text-sm text-muted">
                <CalendarCheck2 size={20} className="shrink-0" aria-hidden />
                <p>
                  Nothing planned for today. Add something above, give any note or sticky a date, or type <span className="font-mono">@today</span> in a checklist.
                </p>
              </div>
            ) : (
              <ul>
                {data?.today.map((p) => <AgendaItemRow key={`${p.item.id}@${p.span.start}`} entry={p} groups={groups} />)}
                {data?.linesToday.map((l) => <TaskLineRow key={l.ref.id} line={l} groups={groups} />)}
              </ul>
            )}
          </ItemDropZone>

          {byDay.size > 0 && (
            <section aria-label="Coming up">
              <Heading>Coming up</Heading>
              {[...byDay].map(([day, entries]) => (
                <div key={day} className="mb-2">
                  <h3 className="px-2 pt-1 text-xs font-medium text-muted">{formatDay(day)}</h3>
                  <ul>
                    {entries.map((p) => (
                      <AgendaItemRow key={`${p.item.id}@${p.span.start}`} entry={p} groups={groups} />
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          )}
        </div>

        <aside className="min-w-0 space-y-6" aria-label="Pinned and recent">
          <section aria-label="Pinned stickies">
            <Heading count={data?.pinned.length}>Pinned stickies</Heading>
            {data && data.pinned.length > 0 ? (
              <div className="-mx-4 lg:-mx-2">
                <ItemCollection items={data.pinned} prefs={{ view: 'cards', sort: 'manual' }} empty={null} />
              </div>
            ) : (
              <p className="flex items-center gap-2 px-2 text-sm text-muted">
                <Pin size={14} aria-hidden /> Pin a sticky to keep it here.
              </p>
            )}
          </section>
          {data && data.recent.length > 0 && (
            <section aria-label="Recently edited">
              <Heading>Recently edited</Heading>
              <ul className="space-y-1 px-2 text-sm">
                {data.recent.map((i) => (
                  <li key={i.id} className="truncate">
                    <ItemLink item={i} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </Pane>
  );
}
