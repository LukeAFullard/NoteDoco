import { useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Bell, CalendarDays, Flag, Repeat } from 'lucide-react';
import { db } from '@/data/db';
import type { Item, Reminder, TimeSpan } from '@/data/types';
import { setTimeWithUndo } from '@/data/actions';
import { toastWithUndo } from '@/app/undoActions';
import { closeDateDialog, useUi } from '@/app/ui';
import { usePrefs } from '@/app/prefs';
import { Button } from '@/design/Button';
import { Dialog } from '@/design/Dialog';
import { Switch } from '@/design/Switch';
import { cn } from '@/design/cn';
import { newId } from '@/lib/ids';
import { dayName, describeRule, formatRule, parseRule, type Freq, type Rule } from '@/lib/recurrence';
import {
  addDays, allDaySpan, atTime, firstDayOfWeek, formatSpan, startOfWeek, timeInputValue, timedSpan, toLocalDate, todayLocal, weekday,
} from '@/lib/time';
import { parseNatural } from './naturalDate';

const input = 'h-9 rounded-panel border border-border bg-surface px-2 text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-focus';
const chip = 'rounded-full border border-border px-3 py-1 text-sm hover:bg-accent-soft outline-none focus-visible:ring-2 focus-visible:ring-focus';

type ReminderChoice = 'none' | 'at' | '10m' | '1h' | '1d' | 'custom';
type RepeatChoice = 'none' | 'DAILY' | 'WEEKDAYS' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'custom';

interface Form {
  whenDate: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
  endDate: string;
  dueDate: string;
  repeat: RepeatChoice;
  rule: Rule;
  reminder: ReminderChoice;
  reminderAt: string; // datetime-local
  todo: boolean;
}

function repeatChoice(r: Rule | null): RepeatChoice {
  if (!r) return 'none';
  if (r.interval !== 1 || r.until) return 'custom';
  if (r.freq === 'WEEKLY') {
    if (r.byDay?.join() === '1,2,3,4,5') return 'WEEKDAYS';
    return !r.byDay || r.byDay.length === 1 ? 'WEEKLY' : 'custom';
  }
  return r.freq;
}

function initialForm(item: Item | undefined): Form {
  const when = item?.when ?? null;
  const rule = parseRule(item?.recurrence);
  const start = when && !when.allDay ? new Date(when.start) : null;
  const end = when && !when.allDay && when.end ? new Date(when.end) : null;
  const firstReminder = item?.reminders[0];
  return {
    whenDate: when ? (when.allDay ? when.start : toLocalDate(start!)) : '',
    allDay: when ? when.allDay : true,
    startTime: start ? timeInputValue(start) : '09:00',
    endTime: end ? timeInputValue(end) : '',
    endDate: when?.allDay ? (when.end ?? '') : end && toLocalDate(end) !== toLocalDate(start!) ? toLocalDate(end) : '',
    dueDate: item?.due ? (item.due.allDay ? item.due.start : toLocalDate(new Date(item.due.start))) : '',
    repeat: repeatChoice(rule),
    rule: rule ?? { freq: 'WEEKLY', interval: 1, byDay: null, until: null, mode: 'move' },
    reminder: firstReminder ? 'custom' : 'none',
    reminderAt: firstReminder ? toDatetimeLocal(new Date(firstReminder.at)) : '',
    todo: !!item?.task,
  };
}

const toDatetimeLocal = (d: Date) => `${toLocalDate(d)}T${timeInputValue(d)}`;

function buildWhen(f: Form): TimeSpan | null {
  if (!f.whenDate) return null;
  if (f.allDay) return allDaySpan(f.whenDate, f.endDate && f.endDate > f.whenDate ? f.endDate : null);
  const start = atTime(f.whenDate, f.startTime || '09:00');
  const end = f.endTime ? atTime(f.endDate || f.whenDate, f.endTime) : null;
  return timedSpan(start, end);
}

function buildRule(f: Form, anchor: string): Rule | null {
  const base = { interval: 1, byDay: null, until: null, mode: f.rule.mode } as const;
  switch (f.repeat) {
    case 'none':
      return null;
    case 'DAILY':
    case 'MONTHLY':
    case 'YEARLY':
      return { ...base, freq: f.repeat };
    case 'WEEKDAYS':
      return { ...base, freq: 'WEEKLY', byDay: [1, 2, 3, 4, 5] };
    case 'WEEKLY':
      return { ...base, freq: 'WEEKLY', byDay: [weekday(anchor)] };
    case 'custom':
      return { ...f.rule, byDay: f.rule.freq === 'WEEKLY' ? (f.rule.byDay?.length ? f.rule.byDay : [weekday(anchor)]) : null };
  }
}

function buildReminders(f: Form, when: TimeSpan | null, due: TimeSpan | null, existing: Reminder[]): Reminder[] {
  const base = when ?? due;
  let at: Date | null = null;
  if (f.reminder === 'custom') at = f.reminderAt ? new Date(f.reminderAt) : null;
  else if (f.reminder !== 'none' && base) {
    const start = base.allDay ? atTime(base.start, '09:00') : new Date(base.start);
    const minutes = { at: 0, '10m': 10, '1h': 60, '1d': 24 * 60 }[f.reminder];
    at = new Date(start.getTime() - minutes * 60_000);
  }
  if (!at || Number.isNaN(at.getTime())) return [];
  const same = existing.find((r) => r.at === at.toISOString());
  return [same ?? { id: newId(), at: at.toISOString(), firedAt: null }];
}

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <fieldset className="border-t border-border px-5 py-3">
      <legend className="sr-only">{title}</legend>
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        <span aria-hidden className="text-muted">
          {icon}
        </span>
        {title}
      </div>
      {children}
    </fieldset>
  );
}

function Form({ items }: { items: Item[] }) {
  const [f, setF] = useState<Form>(() => initialForm(items[0]));
  const [typed, setTyped] = useState('');
  const set = (patch: Partial<Form>) => setF((prev) => ({ ...prev, ...patch }));
  const weekStart = firstDayOfWeek(usePrefs((p) => p.weekStart));
  const today = todayLocal();
  const parsed = typed.trim() ? parseNatural(typed) : null;

  const applySpan = (span: TimeSpan) => {
    if (span.allDay) set({ whenDate: span.start, allDay: true, endDate: span.end ?? '' });
    else {
      const s = new Date(span.start);
      const e = span.end ? new Date(span.end) : null;
      set({ whenDate: toLocalDate(s), allDay: false, startTime: timeInputValue(s), endTime: e ? timeInputValue(e) : '', endDate: e && toLocalDate(e) !== toLocalDate(s) ? toLocalDate(e) : '' });
    }
  };

  const when = buildWhen(f);
  const due = f.dueDate ? allDaySpan(f.dueDate) : null;
  const anchor = f.whenDate || f.dueDate || today;
  const rule = when || due ? buildRule(f, anchor) : null;

  const save = async () => {
    const reminders = buildReminders(f, when, due, items[0]?.reminders ?? []);
    const patch = {
      when,
      due,
      recurrence: rule ? formatRule(rule) : null,
      reminders,
      task: f.todo ? (items[0]?.task ?? { done: false, doneAt: null }) : null,
    };
    toastWithUndo(await setTimeWithUndo(items.map((i) => i.id), patch, when || due ? 'Date set' : 'Date removed'));
    closeDateDialog();
  };

  const quick: [string, string][] = [
    ['Today', today],
    ['Tomorrow', addDays(today, 1)],
    ['This weekend', addDays(startOfWeek(today, 1), 5) < today ? today : addDays(startOfWeek(today, 1), 5)],
    ['Next week', addDays(startOfWeek(today, weekStart), 7)],
  ];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="px-5 pb-3 pt-2">
        <label className="block text-sm">
          <span className="sr-only">Type a date</span>
          <input
            autoFocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && parsed) {
                e.preventDefault();
                applySpan(parsed.span);
                setTyped('');
              }
            }}
            placeholder="Type a date: fri 3pm, next tue, 5–9 oct"
            className={cn(input, 'w-full')}
          />
        </label>
        <p aria-live="polite" className="mt-1 min-h-5 text-xs text-muted">
          {typed.trim() && (parsed ? <>Press Enter for {formatSpan(parsed.span)}</> : 'No date found yet')}
        </p>
        <div className="mt-1 flex flex-wrap gap-2">
          {quick.map(([label, day]) => (
            <button key={label} type="button" className={cn(chip, f.whenDate === day && f.allDay && 'border-accent bg-accent-soft')} onClick={() => set({ whenDate: day, allDay: true, endDate: '' })}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <Section icon={<CalendarDays size={16} />} title="When">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <span className="sr-only">Date</span>
            <input type="date" value={f.whenDate} onChange={(e) => set({ whenDate: e.target.value })} className={input} />
          </label>
          {f.whenDate && (
            <>
              {!f.allDay && (
                <>
                  <label className="text-sm">
                    <span className="sr-only">Start time</span>
                    <input type="time" value={f.startTime} onChange={(e) => set({ startTime: e.target.value })} className={input} />
                  </label>
                  <span aria-hidden className="text-muted">
                    –
                  </span>
                  <label className="text-sm">
                    <span className="sr-only">End time</span>
                    <input type="time" value={f.endTime} onChange={(e) => set({ endTime: e.target.value })} className={input} />
                  </label>
                </>
              )}
              <Button size="sm" variant="ghost" onPress={() => set({ whenDate: '', endDate: '' })}>
                Clear
              </Button>
            </>
          )}
        </div>
        {f.whenDate && (
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <Switch isSelected={f.allDay} onChange={(allDay) => set({ allDay })}>
              All day
            </Switch>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted">Until</span>
              <input type="date" min={f.whenDate} value={f.endDate} onChange={(e) => set({ endDate: e.target.value })} className={input} aria-label="End date" />
            </label>
          </div>
        )}
      </Section>

      <Section icon={<Flag size={16} />} title="Due">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm">
            <span className="sr-only">Due date</span>
            <input type="date" value={f.dueDate} onChange={(e) => set({ dueDate: e.target.value })} className={input} />
          </label>
          {f.dueDate && (
            <Button size="sm" variant="ghost" onPress={() => set({ dueDate: '' })}>
              Clear
            </Button>
          )}
        </div>
      </Section>

      <Section icon={<Repeat size={16} />} title="Repeat">
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Repeat" value={f.repeat} onChange={(e) => set({ repeat: e.target.value as RepeatChoice })} className={input} disabled={!f.whenDate && !f.dueDate}>
            <option value="none">Doesn’t repeat</option>
            <option value="DAILY">Every day</option>
            <option value="WEEKDAYS">Every weekday</option>
            <option value="WEEKLY">Weekly on {dayName(weekday(anchor), 'long')}</option>
            <option value="MONTHLY">Monthly</option>
            <option value="YEARLY">Yearly</option>
            <option value="custom">Custom…</option>
          </select>
          {!f.whenDate && !f.dueDate && <span className="text-xs text-muted">Pick a date first.</span>}
        </div>
        {f.repeat === 'custom' && (
          <div className="mt-2 space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span>Every</span>
              <input type="number" min={1} max={99} aria-label="Interval" value={f.rule.interval} onChange={(e) => set({ rule: { ...f.rule, interval: Math.max(1, Number(e.target.value) || 1) } })} className={cn(input, 'w-16')} />
              <select aria-label="Unit" value={f.rule.freq} onChange={(e) => set({ rule: { ...f.rule, freq: e.target.value as Freq } })} className={input}>
                <option value="DAILY">{f.rule.interval === 1 ? 'day' : 'days'}</option>
                <option value="WEEKLY">{f.rule.interval === 1 ? 'week' : 'weeks'}</option>
                <option value="MONTHLY">{f.rule.interval === 1 ? 'month' : 'months'}</option>
                <option value="YEARLY">{f.rule.interval === 1 ? 'year' : 'years'}</option>
              </select>
              <label className="flex items-center gap-2">
                <span className="text-muted">until</span>
                <input type="date" aria-label="Repeat until" value={f.rule.until ?? ''} onChange={(e) => set({ rule: { ...f.rule, until: e.target.value || null } })} className={input} />
              </label>
            </div>
            {f.rule.freq === 'WEEKLY' && (
              <div role="group" aria-label="On these days" className="flex flex-wrap gap-1.5">
                {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                  const on = (f.rule.byDay ?? [weekday(anchor)]).includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        const days = new Set(f.rule.byDay ?? [weekday(anchor)]);
                        if (on) days.delete(d);
                        else days.add(d);
                        set({ rule: { ...f.rule, byDay: [...days].sort() } });
                      }}
                      className={cn(chip, 'min-w-11', on && 'border-accent bg-accent-soft font-medium')}
                    >
                      {dayName(d, 'short')}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {rule && (
          <div className="mt-2 space-y-1 text-sm">
            <p className="text-muted">{describeRule(rule)}.</p>
            <label className="flex items-center gap-2">
              <span>Each time:</span>
              <select aria-label="Each time" value={f.rule.mode} onChange={(e) => set({ rule: { ...f.rule, mode: e.target.value as Rule['mode'] } })} className={input}>
                <option value="move">move it to the next date when done</option>
                <option value="copy">start a fresh copy (a template)</option>
              </select>
            </label>
          </div>
        )}
      </Section>

      <Section icon={<Bell size={16} />} title="Reminder">
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Reminder" value={f.reminder} onChange={(e) => set({ reminder: e.target.value as ReminderChoice })} className={input}>
            <option value="none">No reminder</option>
            <option value="at" disabled={!when && !due}>
              At the time{(when ?? due)?.allDay ? ' (9:00)' : ''}
            </option>
            <option value="10m" disabled={!when && !due}>
              10 minutes before
            </option>
            <option value="1h" disabled={!when && !due}>
              1 hour before
            </option>
            <option value="1d" disabled={!when && !due}>
              The day before
            </option>
            <option value="custom">At a set time…</option>
          </select>
          {f.reminder === 'custom' && (
            <input type="datetime-local" aria-label="Remind me at" value={f.reminderAt} onChange={(e) => set({ reminderAt: e.target.value })} className={input} />
          )}
        </div>
        {f.reminder !== 'none' && <p className="mt-1.5 text-xs text-muted">NoteDoco reminds you while it’s open. For alerts you can’t miss, also add it to your calendar.</p>}
      </Section>

      <div className="border-t border-border px-5 py-3">
        <Switch isSelected={f.todo} onChange={(todo) => set({ todo })}>
          It’s a to-do (show a checkbox)
        </Switch>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3">
        {when && <span className="mr-auto text-xs text-muted">{formatSpan(when)}</span>}
        <Button variant="ghost" onPress={closeDateDialog}>
          Cancel
        </Button>
        <Button variant="primary" type="submit">
          Save
        </Button>
      </div>
    </form>
  );
}

/** Dates, due date, repeat, reminder and to-do for one or more items (TIME-1, TIME-13, TIME-15). */
export function DateDialog() {
  const ids = useUi((s) => s.dateDialogIds);
  const items = useLiveQuery(async () => (ids ? (await db.items.bulkGet(ids)).filter((i): i is Item => !!i) : []), [ids?.join()]);
  if (!ids || !items) return null;
  return (
    <Dialog isOpen onOpenChange={(o) => !o && closeDateDialog()} title={items.length > 1 ? `Date for ${items.length} items` : 'Date and repeat'}>
      <Form key={ids.join()} items={items} />
    </Dialog>
  );
}
