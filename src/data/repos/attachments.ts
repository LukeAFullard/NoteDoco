import { db } from '../db';
import { newId, nowIso } from '@/lib/ids';
import type { Attachment, Id } from '../types';
import { blobBytes } from '@/lib/blob';

/** Markdown URL scheme for stored attachments: ![photo](ndoco:attachment/<id>). */
export const ATTACHMENT_SCHEME = 'ndoco:attachment/';

async function sha256(blob: Blob): Promise<string> {
  try {
    const hash = await crypto.subtle.digest('SHA-256', (await blobBytes(blob)) as BufferSource);
    return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return ''; // subtle crypto is unavailable outside secure contexts; the hash is only for de-duplication
  }
}

export async function addAttachment(itemId: Id, file: Blob, name = (file as File).name || 'file'): Promise<Attachment> {
  const att: Attachment = {
    id: newId(),
    itemId,
    name,
    mime: file.type || 'application/octet-stream',
    size: file.size,
    sha256: await sha256(file),
    blob: file,
    createdAt: nowIso(),
  };
  await db.attachments.add(att);
  return att;
}

export const attachmentUrl = (id: Id) => `${ATTACHMENT_SCHEME}${id}`;

/**
 * Gives another item its own copies of the attachments a text links to, and returns the text
 * pointing at the copies (Duplicate), so the copy keeps its pictures when the original is purged.
 */
export async function copyAttachments(toItemId: Id, text: string): Promise<string> {
  const ids = [...new Set([...text.matchAll(/ndoco:attachment\/([0-9a-f-]+)/g)].map((m) => m[1]!))];
  let out = text;
  for (const id of ids) {
    const att = await db.attachments.get(id);
    if (!att) continue;
    const copy = { ...att, id: newId(), itemId: toItemId, createdAt: nowIso() };
    await db.attachments.add(copy);
    out = out.split(attachmentUrl(id)).join(attachmentUrl(copy.id));
  }
  return out;
}

export function attachmentIdFromUrl(url: string): Id | null {
  return url.startsWith(ATTACHMENT_SCHEME) ? url.slice(ATTACHMENT_SCHEME.length) : null;
}

/** Markdown for an attachment: an inline image for images, a link otherwise. */
export function attachmentMarkdown(att: Attachment): string {
  const label = att.name.replace(/[[\]]/g, '');
  return att.mime.startsWith('image/') ? `![${label}](${attachmentUrl(att.id)})` : `[${label}](${attachmentUrl(att.id)})`;
}

const objectUrls = new Map<Id, string>();

/** An object URL for showing a stored attachment (cached for the session). */
export async function objectUrlFor(id: Id): Promise<string | null> {
  const cached = objectUrls.get(id);
  if (cached) return cached;
  const att = await db.attachments.get(id);
  if (!att) return null;
  const url = URL.createObjectURL(att.blob);
  objectUrls.set(id, url);
  return url;
}
