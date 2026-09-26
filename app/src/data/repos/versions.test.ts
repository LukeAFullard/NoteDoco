import { db } from '../db';
import { freshDb } from '@/test/db';
import { undo } from '../undo';
import { createItem, setBodyText } from './items';
import { decodeVersion, listVersions, restoreVersion, snapshotNote } from './versions';

beforeEach(freshDb);

it('snapshots only when the text changed, and respects the idle interval', async () => {
  const id = await createItem({ kind: 'note', text: 'v1' });
  const t0 = new Date('2026-09-26T10:00:00Z');
  expect(await snapshotNote(id, 'idle', 0, t0)).toBe(true);
  expect(await snapshotNote(id, 'idle', 0, new Date('2026-09-26T10:01:00Z'))).toBe(false); // unchanged
  await setBodyText(id, 'v2');
  expect(await snapshotNote(id, 'idle', 5 * 60_000, new Date('2026-09-26T10:02:00Z'))).toBe(false); // too soon
  expect(await snapshotNote(id, 'idle', 5 * 60_000, new Date('2026-09-26T10:06:00Z'))).toBe(true);
  expect((await listVersions(id)).map((v) => decodeVersion(v).text)).toEqual(['v2', 'v1']);
});

it('restores a version after saving the current text, and undoes the restore', async () => {
  const id = await createItem({ kind: 'note', text: 'first draft' });
  await snapshotNote(id, 'idle');
  await setBodyText(id, 'second draft');
  const [v1] = await listVersions(id);
  await restoreVersion(v1!.id);
  expect((await db.noteBodies.get(id))!.text).toBe('first draft');
  expect((await listVersions(id)).map((v) => decodeVersion(v).text)).toEqual(['second draft', 'first draft']);
  await undo();
  expect((await db.noteBodies.get(id))!.text).toBe('second draft');
});
