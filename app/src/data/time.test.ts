import { db } from './db';
import { freshDb } from '@/test/db';
import { createItem, setBodyText } from './repos/items';
import { completeWithUndo, setTimeWithUndo, toggleChecklistLineWithUndo } from './actions';
import { undo } from './undo';
import { allDaySpan, todayLocal, addDays } from '@/lib/time';

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
