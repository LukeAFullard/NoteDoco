import { db } from '@/data/db';
import { showToast } from '@/design/toast';

/** Exports every dated item as one .ics file for the device's calendar app (TIME-14). */
export async function exportCalendar() {
  const [{ toIcs }, { download }] = await Promise.all([import('@/lib/ics'), import('@/backup/backup')]);
  const items = await db.items.filter((i) => !i.deletedAt && !i.archived && !!(i.when || i.due)).toArray();
  if (!items.length) return showToast({ message: 'Nothing has a date yet.' }, 4000);
  download(new Blob([toIcs(items)], { type: 'text/calendar' }), 'notedoco-calendar.ics');
  showToast({ message: `Exported ${items.length} dated ${items.length === 1 ? 'item' : 'items'}. Open the file to add them to your calendar.` }, 6000);
}
