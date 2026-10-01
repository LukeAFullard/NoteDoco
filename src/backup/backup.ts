import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { db } from '@/data/db';
import { taskRefsFor } from '@/data/taskRefs';
import type { Attachment, Meta } from '@/data/types';
import { setSetting } from '@/data/repos/settings';
import { blobBytes } from '@/lib/blob';

/**
 * Full backup (SAFE-6): one .zip with a manifest, every table as JSON, and attachments as
 * real files. Restoring can replace everything or merge (newest edit wins per record).
 */
export const BACKUP_FORMAT = 'notedoco-backup';
export const BACKUP_VERSION = 1;

export interface BackupManifest {
  format: typeof BACKUP_FORMAT;
  version: number;
  schemaVersion: number;
  exportedAt: string;
  appVersion: string;
  counts: Record<string, number>;
}

/** Tables in the backup. Attachments' blobs go in attachments/<id>; the rest is JSON. */
const TABLES = [
  'groups', 'items', 'noteBodies', 'stickyBodies', 'inkDocs', 'inkPages', 'strokes', 'boards',
  'boardNodes', 'boardEdges', 'links', 'taskRefs', 'attachments', 'versions', 'layouts', 'settings',
] as const;
type TableName = (typeof TABLES)[number];

// Binary fields (Uint8Array) round-trip through JSON as base64.
function toBase64(u8: Uint8Array): string {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const u8 = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
  return u8;
}
// Tag check rather than instanceof: typed arrays read back from storage can come from another realm.
const isU8 = (v: unknown): v is Uint8Array => Object.prototype.toString.call(v) === '[object Uint8Array]';
const replacer = (_k: string, v: unknown) => (isU8(v) ? { $u8: toBase64(v) } : v);
const reviver = (_k: string, v: unknown) =>
  v && typeof v === 'object' && '$u8' in (v as Record<string, unknown>) ? fromBase64((v as { $u8: string }).$u8) : v;

export async function createBackup(appVersion = 'dev'): Promise<Blob> {
  const files: Zippable = {};
  const counts: Record<string, number> = {};
  for (const name of TABLES) {
    const rows = await db.table(name).toArray();
    counts[name] = rows.length;
    if (name === 'attachments') {
      const meta = [];
      for (const a of rows as Attachment[]) {
        const { blob, ...rest } = a;
        meta.push(rest);
        files[`attachments/${a.id}`] = [await blobBytes(blob), { level: 0 }];
      }
      files[`data/${name}.json`] = strToU8(JSON.stringify(meta, replacer));
    } else {
      files[`data/${name}.json`] = strToU8(JSON.stringify(rows, replacer));
    }
  }
  const manifest: BackupManifest = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    schemaVersion: db.verno,
    exportedAt: new Date().toISOString(),
    appVersion,
    counts,
  };
  files['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2));
  const zipped = zipSync(files, { level: 6 });
  await setSetting('lastBackupAt', manifest.exportedAt);
  return new Blob([zipped as BlobPart], { type: 'application/zip' });
}

export interface ReadBackup {
  manifest: BackupManifest;
  tables: Partial<Record<TableName, unknown[]>>;
}

export class BackupError extends Error {}

export async function readBackup(file: Blob): Promise<ReadBackup> {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(await blobBytes(file));
  } catch {
    throw new BackupError('This file isn’t a NoteDoco backup (it isn’t a zip file).');
  }
  const m = entries['manifest.json'];
  if (!m) throw new BackupError('This zip file isn’t a NoteDoco backup (no manifest).');
  const manifest = JSON.parse(strFromU8(m)) as BackupManifest;
  if (manifest.format !== BACKUP_FORMAT) throw new BackupError('This zip file isn’t a NoteDoco backup.');
  if (manifest.schemaVersion > db.verno) throw new BackupError('This backup was made by a newer NoteDoco. Update the app, then try again.');
  const tables: ReadBackup['tables'] = {};
  for (const name of TABLES) {
    const raw = entries[`data/${name}.json`];
    if (!raw) continue;
    const rows = JSON.parse(strFromU8(raw), reviver) as Array<Record<string, unknown>>;
    if (name === 'attachments') {
      for (const a of rows) {
        const bytes = entries[`attachments/${a.id as string}`];
        a.blob = new Blob([(bytes ?? new Uint8Array()) as BlobPart], { type: (a.mime as string) || 'application/octet-stream' });
      }
    }
    tables[name] = rows;
  }
  return { manifest, tables };
}

/** Body-like tables are keyed by their item; they follow the item's merge decision. */
const FOLLOWS_ITEM: Partial<Record<TableName, string>> = { noteBodies: 'itemId', stickyBodies: 'itemId', boards: 'itemId' };

/** Derived from bodies, so rebuilt after a restore rather than trusted (older backups lack them). */
async function rebuildTaskRefs(itemIds: string[] | null) {
  const bodies = itemIds
    ? [...(await db.noteBodies.bulkGet(itemIds)), ...(await db.stickyBodies.bulkGet(itemIds))].filter((b) => !!b)
    : [...(await db.noteBodies.toArray()), ...(await db.stickyBodies.toArray())];
  if (itemIds) await db.taskRefs.where('itemId').anyOf(itemIds).delete();
  else await db.taskRefs.clear();
  await db.taskRefs.bulkPut(bodies.flatMap((b) => taskRefsFor(b.itemId, b.text)));
}

export async function restoreBackup(backup: ReadBackup, mode: 'replace' | 'merge'): Promise<{ added: number; updated: number }> {
  let added = 0;
  let updated = 0;
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    if (mode === 'replace') {
      for (const name of TABLES) await db.table(name).clear();
      for (const name of TABLES) {
        const rows = backup.tables[name] ?? [];
        await db.table(name).bulkPut(rows);
        added += rows.length;
      }
      await rebuildTaskRefs(null);
      return;
    }
    // Merge: records with updatedAt keep whichever copy was edited last; others are added if missing.
    const acceptedItems = new Set<string>();
    for (const name of TABLES) {
      if (FOLLOWS_ITEM[name] || name === 'taskRefs') continue;
      const table = db.table(name);
      for (const row of (backup.tables[name] ?? []) as Array<Record<string, unknown>>) {
        const key = table.schema.primKey.keyPath;
        const id = Array.isArray(key) ? key.map((k) => row[k]) : row[key as string];
        const existing = (await table.get(id as never)) as Partial<Meta> | undefined;
        const newer = !existing || ('updatedAt' in row && String(row.updatedAt) > String(existing.updatedAt ?? ''));
        if (!newer) continue;
        await table.put(row);
        if (existing) updated++;
        else added++;
        if (name === 'items') acceptedItems.add(row.id as string);
      }
    }
    for (const [name, field] of Object.entries(FOLLOWS_ITEM) as Array<[TableName, string]>) {
      const rows = ((backup.tables[name] ?? []) as Array<Record<string, unknown>>).filter((r) => acceptedItems.has(r[field] as string));
      await db.table(name).bulkPut(rows);
    }
    await rebuildTaskRefs([...acceptedItems]);
  });
  return { added, updated };
}

export function backupFileName(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `notedoco-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.zip`;
}

/** Saves a blob as a download. */
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
