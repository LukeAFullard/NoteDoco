import { db } from '@/data/db';
import { loadInk } from '@/data/repos/ink';
import { addAttachment } from '@/data/repos/attachments';
import { touched } from '@/data/meta';
import { fromStored } from '@/canvas/model';
import { layoutPages } from '@/canvas/paper';
import { renderPageCanvas } from '@/canvas/render';

/** Thumbnail width in CSS pixels, drawn at 2× for sharp screens; it shows the top of page 1 at 4:3. */
const WIDTH = 240;

/**
 * Redraws an ink note's thumbnail (P3.9) for cards and the timeline: the top of its first
 * page, saved as an attachment and linked from `Item.thumbnailId`. The previous thumbnail is
 * removed: it's a cached picture, not the user's content, so there's nothing to restore.
 */
export async function updateThumbnail(itemId: string): Promise<void> {
  const item = await db.items.get(itemId);
  if (!item || item.kind !== 'ink') return;
  const { pages, strokes, elements } = await loadInk(itemId);
  const page = pages[0];
  if (!page) return;
  const [box] = layoutPages([page]);
  const own = strokes.filter((s) => s.pageId === page.id).map(fromStored);
  const els = elements.filter((e) => e.pageId === page.id);
  let blob: Blob | null = null;
  if (own.length || els.length) {
    const images = new Map<string, ImageBitmap>();
    for (const e of els) {
      const att = e.attachmentId ? await db.attachments.get(e.attachmentId) : undefined;
      const bmp = att ? await createImageBitmap(att.blob).catch(() => null) : null;
      if (att && bmp) images.set(att.id, bmp);
    }
    const canvas = renderPageCanvas(box!, own, WIDTH, 2, { minX: 0, minY: 0, maxX: box!.w, maxY: box!.w * 0.75 }, els, images);
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  }
  const att = blob ? await addAttachment(itemId, blob, 'thumbnail.png') : null;
  await db.transaction('rw', db.items, db.attachments, async () => {
    const it = await db.items.get(itemId);
    if (!it) return;
    if (it.thumbnailId) await db.attachments.delete(it.thumbnailId);
    // A derived picture: stamp the write without counting it as an edit to the note.
    await db.items.put({ ...touched(it, { thumbnailId: att?.id ?? null }), updatedAt: it.updatedAt });
  });
}
