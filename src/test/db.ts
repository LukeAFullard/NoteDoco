import { db } from '@/data/db';
import { clearUndo } from '@/data/undo';

/** Gives each test an empty database. */
export async function freshDb() {
  db.close();
  await db.delete();
  await db.open();
  clearUndo();
}
