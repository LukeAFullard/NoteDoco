import { db } from './db';
import { freshDb } from '@/test/db';
import { createItem, setBodyText } from './repos/items';
import { applySpanChange, completeWithUndo, dateItemsWithUndo, rescheduleWithUndo, setTimeWithUndo, toggleChecklistLineWithUndo } from './actions';
import { undo } from './undo';
import { allDaySpan, timedSpan, todayLocal, addDays } from '@/lib/time';

beforeEach(freshDb);

const today = todayLocal();

it('indexes checklist lines with their @dates as the text changes', async () => {
  const id = await createItem({ kind: 'note', text: 'Trip\n- [ ] book @2026-10-02\n- [x] pack' });
  expect((await db.taskRefs.where('itemId').equals(id).toArray()).map((r) => [r.text, r.date, r.done])).toEqual([
    ['book @2026-10-02', '2026-10-02', false],
    ['pack', null, true],
  ]);
  await setBodyText(id, 'Trip\n- [ ] book');
  expect(await db.taskRefs.where('itemId').equals(id).count()).toBe(1);
  await toggleChecklistLineWithUndo(id, 0, false);
  expect((await db.taskRefs.get(`${id}:0`))!.done).toBe(true);
  await undo();
  expect((await db.taskRefs.get(`${id}:0`))!.done).toBe(false);
});

it('ticks a one-off to-do, and undo unticks it', async () => {
  const id = await createItem({ kind: 'sticky', text: 'milk', task: true });
  const { result } = await completeWithUndo(id);
  expect(result.kind).toBe('done');
  expect((await db.items.get(id))!.task!.done).toBe(true);
  await undo();
  expect((await db.items.get(id))!.task!.done).toBe(false);
});

it('moves a repeating item to its next date and resets its checklist', async () => {
  const id = await createItem({ kind: 'note', text: 'Plants\n- [x] water\n- [x] feed', when: allDaySpan(today) });
  await db.items.update(id, { recurrence: 'FREQ=DAILY;INTERVAL=2', reminders: [{ id: 'r', at: new Date().toISOString(), firedAt: new Date().toISOString() }] });
  const { result, label } = await completeWithUndo(id);
  expect(result).toEqual({ kind: 'next', next: addDays(today, 2) });
  expect(label).toMatch(/^Done\. Next:/);
  const it = (await db.items.get(id))!;
  expect(it.when!.start).toBe(addDays(today, 2));
  expect(it.reminders[0]!.firedAt).toBeNull();
  expect((await db.noteBodies.get(id))!.text).toBe('Plants\n- [ ] water\n- [ ] feed');
  await undo();
  expect((await db.items.get(id))!.when!.start).toBe(today);
  expect((await db.noteBodies.get(id))!.text).toBe('Plants\n- [x] water\n- [x] feed');
});

it('catches an overdue repeat up to after today', async () => {
  const id = await createItem({ kind: 'sticky', text: 'bins', when: allDaySpan(addDays(today, -10)) });
  await db.items.update(id, { recurrence: 'FREQ=DAILY' });
  await completeWithUndo(id);
  expect((await db.items.get(id))!.when!.start).toBe(addDays(today, 1));
});

it('starts a fresh copy of a repeating template', async () => {
  const id = await createItem({ kind: 'note', text: 'Weekly review\n- [x] inbox zero', when: allDaySpan(today) });
  await db.items.update(id, { recurrence: 'FREQ=WEEKLY;X-NDOCO-MODE=COPY' });
  const { result } = await completeWithUndo(id);
  if (result.kind !== 'copied') throw new Error('expected a copy');
  const copy = (await db.items.get(result.copyId))!;
  expect(copy.when!.start).toBe(today);
  expect(copy.recurrence).toBeNull();
  expect((await db.noteBodies.get(copy.id))!.text).toBe('Weekly review\n- [ ] inbox zero');
  expect((await db.items.get(id))!.when!.start).toBe(addDays(today, 7));
  await undo();
  expect((await db.items.get(result.copyId))!.deletedAt).not.toBeNull();
  expect((await db.items.get(id))!.when!.start).toBe(today);
});

it('sets dates undoably', async () => {
  const id = await createItem({ kind: 'note', text: 'x' });
  await setTimeWithUndo([id], { due: allDaySpan('2026-10-01') });
  expect((await db.items.get(id))!.due!.start).toBe('2026-10-01');
  await undo();
  expect((await db.items.get(id))!.due).toBeNull();
});

it('reschedules by dragging, moving reminders and the group along, undoably', async () => {
  const id = await createItem({ kind: 'sticky', text: 'x', when: allDaySpan('2026-10-01') });
  await db.items.update(id, { reminders: [{ id: 'r', at: new Date(2026, 9, 1, 9).toISOString(), firedAt: null }] });
  const item = (await db.items.get(id))!;
  const label = await rescheduleWithUndo(item, 'when', item.when!, allDaySpan('2026-10-03'), { groupId: null });
  expect(label).toMatch(/^Moved to /);
  const moved = (await db.items.get(id))!;
  expect(moved.when!.start).toBe('2026-10-03');
  expect(new Date(moved.reminders[0]!.at).getDate()).toBe(3);
  await undo();
  expect((await db.items.get(id))!.when!.start).toBe('2026-10-01');
});

it('moves a whole repeat when one of its later occurrences is dragged', () => {
  const stored = allDaySpan('2026-10-01');
  expect(applySpanChange(stored, allDaySpan('2026-10-08'), allDaySpan('2026-10-09'))).toEqual(allDaySpan('2026-10-02'));
  expect(applySpanChange(stored, allDaySpan('2026-10-08'), allDaySpan('2026-10-08', '2026-10-10'))).toEqual(allDaySpan('2026-10-01', '2026-10-03'));
  const t = timedSpan(new Date(2026, 9, 1, 9), new Date(2026, 9, 1, 10));
  const moved = applySpanChange(t, t, timedSpan(new Date(2026, 9, 1, 11), new Date(2026, 9, 1, 12)));
  expect(new Date(moved.start).getHours()).toBe(11);
  expect(new Date(moved.end!).getHours()).toBe(12);
});

it('dates dropped items: dated ones keep their time, undated ones get the day', async () => {
  const dated = await createItem({ kind: 'sticky', text: 'a', when: timedSpan(new Date(2026, 9, 1, 15), new Date(2026, 9, 1, 16)) });
  const undated = await createItem({ kind: 'sticky', text: 'b' });
  await dateItemsWithUndo([dated, undated], '2026-10-05', { groupId: null });
  const a = (await db.items.get(dated))!;
  expect(new Date(a.when!.start).getDate()).toBe(5);
  expect(new Date(a.when!.start).getHours()).toBe(15);
  expect((await db.items.get(undated))!.when).toEqual(allDaySpan('2026-10-05'));
  await undo();
  expect((await db.items.get(undated))!.when).toBeNull();
});
