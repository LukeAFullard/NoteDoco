import { db } from '@/data/db';
import { freshDb } from '@/test/db';
import { createGroup } from '@/data/repos/groups';
import { createItem, setBodyText } from '@/data/repos/items';
import { addAttachment } from '@/data/repos/attachments';
import { snapshotNote } from '@/data/repos/versions';
import { blobText } from '@/lib/blob';
import { BackupError, createBackup, readBackup, restoreBackup } from './backup';

beforeEach(freshDb);

async function seed() {
  const g = await createGroup({ name: 'Work', colour: 'sky' });
  const note = await createItem({ kind: 'note', groupId: g, text: '# Plan\n- [ ] ship #launch' });
  const sticky = await createItem({ kind: 'sticky', text: 'Call Sam', colour: 'coral' });
  const att = await addAttachment(note, new Blob(['hello image'], { type: 'image/png' }), 'pic.png');
  await snapshotNote(note, 'idle');
  return { g, note, sticky, att };
}

it('round-trips everything through a backup, including attachments and binary versions', async () => {
  const { g, note, sticky, att } = await seed();
  const zip = await createBackup('test');
  await freshDb();
  const backup = await readBackup(zip);
  expect(backup.manifest).toMatchObject({ format: 'notedoco-backup', counts: { items: 2, groups: 1, attachments: 1, versions: 1 } });
  await restoreBackup(backup, 'replace');
  expect((await db.groups.get(g))!.name).toBe('Work');
  expect((await db.noteBodies.get(note))!.text).toContain('ship #launch');
  expect((await db.items.get(sticky))!.colour).toBe('coral');
  const a = (await db.attachments.get(att.id))!;
  expect(await blobText(a.blob)).toBe('hello image');
  const snap = (await db.versions.where('itemId').equals(note).first())!.snapshot;
  expect(Object.prototype.toString.call(snap)).toBe('[object Uint8Array]');
  expect(snap.length).toBeGreaterThan(10);
});

it('merges: keeps whichever copy of each item was edited last, adds what is missing', async () => {
  const { note, sticky } = await seed();
  const zip = await createBackup();
  // After the backup: edit the note here (local is newer) and delete the sticky entirely.
  await new Promise((r) => setTimeout(r, 5));
  await setBodyText(note, 'Local edit');
  await db.items.delete(sticky);
  await db.stickyBodies.delete(sticky);
  const result = await restoreBackup(await readBackup(zip), 'merge');
  expect((await db.noteBodies.get(note))!.text).toBe('Local edit');
  expect((await db.stickyBodies.get(sticky))!.text).toBe('Call Sam');
  expect(result.added).toBeGreaterThan(0);
});

it('rejects files that are not NoteDoco backups', async () => {
  await expect(readBackup(new Blob(['not a zip']))).rejects.toBeInstanceOf(BackupError);
});
