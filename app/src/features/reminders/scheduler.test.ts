import { db } from '@/data/db';
import { freshDb } from '@/test/db';
import { createItem } from '@/data/repos/items';
import { useToasts } from '@/design/toast';
import { startReminders } from './scheduler';
import { useMissed } from './store';

beforeEach(freshDb);

it('fires reminders that are due now, and collects ones missed while closed', async () => {
  const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
  const onTime = await createItem({ kind: 'sticky', text: 'Stretch' });
  const missed = await createItem({ kind: 'sticky', text: 'Call the bank' });
  const later = await createItem({ kind: 'sticky', text: 'Later' });
  await db.items.update(onTime, { reminders: [{ id: 'a', at: ago(0.5), firedAt: null }] });
  await db.items.update(missed, { reminders: [{ id: 'b', at: ago(90), firedAt: null }] });
  await db.items.update(later, { reminders: [{ id: 'c', at: new Date(Date.now() + 3_600_000).toISOString(), firedAt: null }] });

  startReminders();
  await vi.waitFor(() => expect(useMissed.getState().missed.map((m) => m.item.title)).toEqual(['Call the bank']));
  await vi.waitFor(() => expect(useToasts.getState().toasts.map((t) => t.message)).toContain('Reminder: Stretch'));
  expect((await db.items.get(onTime))!.reminders[0]!.firedAt).not.toBeNull();
  expect((await db.items.get(missed))!.reminders[0]!.firedAt).not.toBeNull();
  expect((await db.items.get(later))!.reminders[0]!.firedAt).toBeNull();
});
