import { db } from '../db';
import type { Id, LocalDate } from '../types';
import { createItem } from './items';
import { getSetting, setSetting } from './settings';
import { allDaySpan, formatLongDay } from '@/lib/time';

/**
 * Today's page (TIME-2): one note per day, dated that day, created on first open. The link
 * is stored as a setting, so renaming or moving the note doesn't lose it.
 */
export async function dailyPage(day: LocalDate): Promise<Id> {
  const key = `dailyPage:${day}`;
  const existing = await getSetting<Id | null>(key, null);
  if (existing) {
    const it = await db.items.get(existing);
    if (it && !it.deletedAt) return existing;
  }
  const id = await createItem({ kind: 'note', text: `# ${formatLongDay(day)}\n\n`, when: allDaySpan(day) });
  await setSetting(key, id);
  return id;
}
