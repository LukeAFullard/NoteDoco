import { db } from '../db';
import { touched } from '../meta';
import type { Id, Item, Reminder } from '../types';

export interface PendingReminder {
  item: Item;
  reminder: Reminder;
}

/** Reminders that haven't gone off yet, on live items. */
export async function pendingReminders(): Promise<PendingReminder[]> {
  const items = await db.items.filter((i) => !i.deletedAt && i.reminders.some((r) => !r.firedAt)).toArray();
  return items
    .flatMap((item) => item.reminders.filter((r) => !r.firedAt).map((reminder) => ({ item, reminder })))
    .sort((a, b) => a.reminder.at.localeCompare(b.reminder.at));
}

/** Records that reminders went off (or were shown as missed), so they never repeat. */
export async function markFired(list: { itemId: Id; reminderId: Id }[], at = new Date().toISOString()) {
  await db.transaction('rw', db.items, async () => {
    for (const itemId of new Set(list.map((l) => l.itemId))) {
      const it = await db.items.get(itemId);
      if (!it) continue;
      const ids = new Set(list.filter((l) => l.itemId === itemId).map((l) => l.reminderId));
      await db.items.put(touched(it, { reminders: it.reminders.map((r) => (ids.has(r.id) ? { ...r, firedAt: at } : r)) }));
    }
  });
}
