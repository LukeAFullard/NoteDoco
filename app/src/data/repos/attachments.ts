import { db } from '../db';
import { newId, nowIso } from '@/lib/ids';
import type { Attachment, Id } from '../types';

/** Markdown URL scheme for stored attachments: ![photo](ndoco:attachment/<id>). */
export const ATTACHMENT_SCHEME = 'ndoco:attachment/';

async function sha256(blob: Blob): Promise<string> {
  try {
    const hash = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
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
