import { db } from './db';
import { freshDb } from '@/test/db';
import { createItem, trashItems } from './repos/items';
import { overdueItems, placedBetween, taskLines } from './agenda';
import { addDays, allDaySpan, timedSpan, todayLocal } from '@/lib/time';

beforeEach(freshDb);

const today = todayLocal();

it('finds dated items in a window, including long spans that started before it', async () => {
  const a = await createItem({ kind: 'note', text: 'Trip', when: allDaySpan(addDays(today, -3), addDays(today, 2)) });
  const b = await createItem({ kind: 'sticky', text: 'Call', when: timedSpan(new Date(new Date().setHours(15, 0, 0, 0))) });
  const c = await createItem({ kind: 'note', text: 'Rent', due: allDaySpan(addDays(today, 1)) });
  await createItem({ kind: 'note', text: 'Later', when: allDaySpan(addDays(today, 10)) });
  const gone = await createItem({ kind: 'note', text: 'Gone', when: allDaySpan(today) });
  await trashItems([gone]);
  const todays = await placedBetween(today, today);
  expect(todays.map((p) => p.item.id)).toEqual([a, b]); // all-day first
  expect((await placedBetween(today, addDays(today, 1))).map((p) => p.item.id)).toContain(c);
  expect((await placedBetween(addDays(today, 1), addDays(today, 1))).find((p) => p.item.id === c)!.basis).toBe('due');
});

it('expands repeats into occurrences, marking later ones as projected', async () => {
  const id = await createItem({ kind: 'sticky', text: 'Bins', when: allDaySpan(today) });
  await db.items.update(id, { recurrence: 'FREQ=DAILY;INTERVAL=2' });
  const week = await placedBetween(today, addDays(today, 6));
  expect(week.map((p) => [p.span.start, p.projected])).toEqual([
    [today, false],
    [addDays(today, 2), true],
    [addDays(today, 4), true],
    [addDays(today, 6), true],
  ]);
  expect(await placedBetween(addDays(today, -5), addDays(today, -1))).toEqual([]);
});

it('places undated items at their created date when asked', async () => {
  const id = await createItem({ kind: 'note', text: 'Idea' });
  expect(await placedBetween(today, today)).toEqual([]);
  expect((await placedBetween(today, today, { undated: true })).map((p) => [p.item.id, p.basis])).toEqual([[id, 'created']]);
});

it('lists checklist lines by date, and overdue items', async () => {
  const note = await createItem({ kind: 'note', text: `Plan\n- [ ] later @${addDays(today, 3)}\n- [ ] now @${today}\n- [ ] someday` });
  expect((await taskLines({ from: today, to: today })).map((l) => l.ref.text)).toEqual([`now @${today}`]);
  expect((await taskLines()).map((l) => l.day)).toEqual([today, addDays(today, 3), null]);
  await trashItems([note]);
  expect(await taskLines()).toEqual([]);

  const late = await createItem({ kind: 'note', text: 'Tax', due: allDaySpan(addDays(today, -2)) });
  const todo = await createItem({ kind: 'sticky', text: 'Milk', when: allDaySpan(addDays(today, -1)), task: true });
  await createItem({ kind: 'note', text: 'Diary', when: allDaySpan(addDays(today, -1)) });
  expect((await overdueItems()).map((i) => i.id)).toEqual([late, todo]);
});

it('shows a project that started months before the window and is still running', async () => {
  const project = await createItem({ kind: 'note', text: 'Thesis', when: allDaySpan(addDays(today, -200), addDays(today, 60)) });
  const placed = await placedBetween(today, addDays(today, 6));
  expect(placed.map((p) => p.item.id)).toContain(project);
});
