import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ListTodo } from 'lucide-react';
import { Radio, RadioGroup } from 'react-aria-components';
import { Pane } from '@/app/Pane';
import { setCurrentGroup } from '@/app/ui';
import { EmptyState } from '@/design/EmptyState';
import { Switch } from '@/design/Switch';
import { db } from '@/data/db';
import { useGroups } from '@/data/hooks';
import { taskLines, type TaskLine } from '@/data/agenda';
import type { Group, Item, LocalDate } from '@/data/types';
import { useLocalPref } from '@/lib/localPref';
import { addDays, isOverdue, itemSpan, spanDays, startOfWeek } from '@/lib/time';
import { CaptureBar } from '@/features/capture/CaptureBar';
import { AgendaItemRow, TaskLineRow } from '@/features/time/AgendaRow';
import { useToday } from '@/features/time/useToday';

/** A to-do: either a whole item (a to-do sticky or note) or one checklist line inside one. */
type Task = { kind: 'item'; item: Item; day: LocalDate | null; done: boolean } | { kind: 'line'; line: TaskLine; day: LocalDate | null; done: boolean };

const taskKey = (t: Task) => (t.kind === 'item' ? t.item.id : t.line.ref.id);
const taskItem = (t: Task) => (t.kind === 'item' ? t.item : t.line.item);

type Bucket = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later' | 'none' | 'done';
const BUCKET_LABELS: Record<Bucket, string> = {
  overdue: 'Overdue',
  today: 'Today',
  tomorrow: 'Tomorrow',
  week: 'This week',
  later: 'Later',
  none: 'No date',
  done: 'Done',
};

function bucketOf(t: Task, today: LocalDate): Bucket {
  if (t.done) return 'done';
  if (t.kind === 'item' && isOverdue(t.item)) return 'overdue';
  if (!t.day) return 'none';
  if (t.day < today) return 'overdue';
  if (t.day === today) return 'today';
  if (t.day === addDays(today, 1)) return 'tomorrow';
  if (t.day < addDays(startOfWeek(today, 1), 7)) return 'week';
  return 'later';
}

/** Tasks (TIME-12): every open checklist line and to-do across all groups, by date or group. */
export function TasksPage() {
  const today = useToday();
  useEffect(() => setCurrentGroup(null), []);
  const groupList = useGroups() ?? [];
  const groups = new Map(groupList.map((g) => [g.id, g] as [string, Group]));
  const [by, setBy] = useLocalPref<'date' | 'group'>('tasksBy', 'date');
  const [showDone, setShowDone] = useLocalPref('tasksShowDone', false);

  const tasks = useLiveQuery(async () => {
    const [items, lines] = await Promise.all([
      db.items.filter((i) => !!i.task && !i.deletedAt && !i.archived).toArray(),
      taskLines(),
    ]);
    const out: Task[] = [
      ...items.map((item): Task => {
        const span = itemSpan(item);
        return { kind: 'item', item, day: span ? spanDays(span)[0] : null, done: !!item.task?.done };
      }),
      ...lines.map((line): Task => ({ kind: 'line', line, day: line.day, done: line.ref.done })),
    ];
    return out.sort((a, b) => (a.day ?? '9999').localeCompare(b.day ?? '9999') || taskItem(a).title.localeCompare(taskItem(b).title));
  }, []);

  const shown = (tasks ?? []).filter((t) => showDone || !t.done);
  const sections: [string, string, Task[]][] = [];
  if (by === 'date') {
    const order: Bucket[] = ['overdue', 'today', 'tomorrow', 'week', 'later', 'none', 'done'];
    for (const b of order) {
      const list = shown.filter((t) => bucketOf(t, today) === b);
      if (list.length) sections.push([b, BUCKET_LABELS[b], list]);
    }
  } else {
    const keys = [null, ...groupList.map((g) => g.id)];
    for (const k of keys) {
      const list = shown.filter((t) => taskItem(t).groupId === k);
      if (list.length) sections.push([k ?? 'inbox', k ? groups.get(k)!.name : 'Inbox', list]);
    }
  }
  const openCount = (tasks ?? []).filter((t) => !t.done).length;

  return (
    <Pane title="Tasks">
      <div className="mx-auto max-w-3xl space-y-5 p-4 lg:p-6">
        <CaptureBar defaultDay={null} placeholder="Add a to-do… try “book dentist next tue”" />
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <RadioGroup value={by} onChange={(v) => setBy(v as 'date' | 'group')} aria-label="Group tasks by" orientation="horizontal" className="flex rounded-panel border border-border p-0.5 text-sm">
            {(['date', 'group'] as const).map((v) => (
              <Radio key={v} value={v} className="cursor-pointer rounded px-3 py-1 text-muted outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-focus data-[selected]:bg-accent-soft data-[selected]:font-medium data-[selected]:text-accent">
                {v === 'date' ? 'By date' : 'By group'}
              </Radio>
            ))}
          </RadioGroup>
          <Switch isSelected={showDone} onChange={setShowDone}>
            Show done
          </Switch>
          <span className="ml-auto text-sm text-muted">{openCount} open</span>
        </div>
        {tasks && !shown.length ? (
          <EmptyState
            icon={<ListTodo size={32} />}
            title={tasks.length ? 'All done' : 'No tasks yet'}
            body="Add a to-do above, tick “It’s a to-do” on any note or sticky, or write a checklist line (- [ ]) in a note. Add @fri to give a line a date."
          />
        ) : (
          sections.map(([key, label, list]) => (
            <section key={key} aria-label={label}>
              <h2 className="mb-1 flex items-baseline gap-2 px-2 text-sm font-semibold uppercase tracking-wide text-muted">
                {label} <span className="font-mono text-xs font-normal">{list.length}</span>
              </h2>
              <ul>
                {list.map((t) =>
                  t.kind === 'item' ? (
                    <AgendaItemRow key={taskKey(t)} entry={{ item: t.item, span: itemSpan(t.item) ?? { start: today, end: null, allDay: true, tz: null }, projected: false, basis: t.item.when ? 'when' : 'due' }} groups={groups} showDate={!!t.day && (by === 'group' || key === 'week' || key === 'later' || key === 'overdue')} time={false} />
                  ) : (
                    <TaskLineRow key={taskKey(t)} line={t.line} groups={groups} keepDate={by === 'group' || key === 'week' || key === 'later' || key === 'overdue'} time={false} />
                  ),
                )}
              </ul>
            </section>
          ))
        )}
      </div>
    </Pane>
  );
}
