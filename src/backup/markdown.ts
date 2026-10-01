import { strToU8, zipSync, type Zippable } from 'fflate';
import { db } from '@/data/db';
import { createGroup } from '@/data/repos/groups';
import { createItem, setManualTags } from '@/data/repos/items';
import { ATTACHMENT_SCHEME } from '@/data/repos/attachments';
import type { Id } from '@/data/types';
import { blobBytes } from '@/lib/blob';
import { compareOrder } from '@/lib/order';

/** Makes a string safe to use as a file name. */
export function safeFileName(name: string, fallback = 'Untitled'): string {
  const clean = name.replace(/[\\/:*?"<>|#^[\]]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  return clean || fallback;
}

const yamlString = (s: string) => JSON.stringify(s);

export interface ExportedNote {
  name: string;
  blob: Blob;
}

/**
 * A note as a portable file (SAFE-8): Markdown with YAML front matter (title, tags, dates), or
 * plain .txt. Notes with attachments export as a .zip holding the note and an assets folder.
 */
export async function exportNote(itemId: Id): Promise<ExportedNote> {
  const [item, body] = await Promise.all([db.items.get(itemId), db.noteBodies.get(itemId)]);
  if (!item || !body) throw new Error('Note not found');
  const base = safeFileName(item.title);
  if (body.format === 'plain') return { name: `${base}.txt`, blob: new Blob([body.text], { type: 'text/plain' }) };

  const attachments = await db.attachments.where('itemId').equals(itemId).toArray();
  let text = body.text;
  const files: Zippable = {};
  for (const a of attachments) {
    const path = `assets/${a.id.slice(-8)}-${safeFileName(a.name, 'file')}`;
    text = text.split(`${ATTACHMENT_SCHEME}${a.id}`).join(encodeURI(path));
    files[path] = await blobBytes(a.blob);
  }
  const front = [
    '---',
    `title: ${yamlString(item.title)}`,
    ...(item.manualTags.length ? [`tags: [${item.manualTags.map(yamlString).join(', ')}]`] : []),
    `created: ${item.createdAt}`,
    `updated: ${item.updatedAt}`,
    '---',
    '',
  ].join('\n');
  const md = front + text;
  if (!attachments.length) return { name: `${base}.md`, blob: new Blob([md], { type: 'text/markdown' }) };
  files[`${base}.md`] = strToU8(md);
  return { name: `${base}.zip`, blob: new Blob([zipSync(files) as BlobPart], { type: 'application/zip' }) };
}

export interface FrontMatter {
  title?: string;
  tags: string[];
  body: string;
}

/** Reads (a practical subset of) YAML front matter: title and tags. */
export function parseFrontMatter(text: string): FrontMatter {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!m) return { tags: [], body: text };
  const yaml = m[1]!;
  const unquote = (s: string) => s.trim().replace(/^["']|["']$/g, '');
  const title = /^title:\s*(.+)$/m.exec(yaml)?.[1];
  const tags: string[] = [];
  const inline = /^tags:\s*\[(.*)\]\s*$/m.exec(yaml)?.[1];
  const listed = /^tags:\s*\n((?:\s*-\s*.+\n?)+)/m.exec(yaml)?.[1];
  const plain = /^tags:\s*([^[\n].*)$/m.exec(yaml)?.[1];
  if (inline) tags.push(...inline.split(',').map(unquote));
  else if (listed) tags.push(...listed.split('\n').map((l) => unquote(l.replace(/^\s*-\s*/, ''))));
  else if (plain) tags.push(...plain.split(/[,\s]+/).map(unquote));
  return { title: title ? unquote(title) : undefined, tags: tags.filter(Boolean), body: text.slice(m[0].length) };
}

/**
 * Imports Markdown and text files (SAFE-9). Files picked as a folder keep their structure:
 * each folder becomes a group (nested), created inside `targetGroupId` or at the top level.
 */
export async function importTextFiles(files: File[], targetGroupId: Id | null): Promise<number> {
  const groupFor = new Map<string, Id | null>([['', targetGroupId]]);
  const ensureGroup = async (dir: string): Promise<Id | null> => {
    if (groupFor.has(dir)) return groupFor.get(dir)!;
    const parts = dir.split('/');
    const parent = await ensureGroup(parts.slice(0, -1).join('/'));
    const id = await createGroup({ name: parts.at(-1)!, parentId: parent });
    groupFor.set(dir, id);
    return id;
  };
  let count = 0;
  const sorted = [...files].sort((a, b) => compareOrder(a.webkitRelativePath || a.name, b.webkitRelativePath || b.name));
  for (const f of sorted) {
    if (!/\.(md|markdown|txt)$/i.test(f.name)) continue;
    const path = (f.webkitRelativePath || f.name).split('/');
    const dir = path.slice(0, -1).join('/');
    const groupId = await ensureGroup(dir);
    const raw = new TextDecoder().decode(await blobBytes(f));
    const plain = /\.txt$/i.test(f.name);
    const fm = plain ? { tags: [], body: raw, title: undefined } : parseFrontMatter(raw);
    const fileTitle = f.name.replace(/\.(md|markdown|txt)$/i, '');
    const title = fm.title ?? fileTitle;
    const firstLine = fm.body.trimStart().split('\n')[0]?.replace(/^#+\s*/, '').trim();
    const text = firstLine === title || !title ? fm.body : `${plain ? title : `# ${title}`}\n\n${fm.body}`;
    const id = await createItem({ kind: 'note', groupId, text, format: plain ? 'plain' : 'markdown' });
    if (fm.tags.length) await setManualTags(id, fm.tags);
    count++;
  }
  return count;
}
