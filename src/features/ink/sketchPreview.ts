import { liveQuery } from 'dexie';
import { db } from '@/data/db';
import { listPages } from '@/data/repos/ink';
import { fromStored } from '@/canvas/model';
import { BLOCK_SIZE, layoutPages } from '@/canvas/paper';
import { renderPageCanvas } from '@/canvas/render';

/** Shortest a sketch preview gets, and the space kept below the lowest ink (page px). */
const MIN_HEIGHT = 160;
const MARGIN = 32;

/**
 * Draws a sketch block's preview into `canvas` (NOTE-8) and keeps it up to date as the
 * sketch is edited, at the width of `sizer`. Returns a function that stops it.
 * Only the drawn part of the page is shown, so a small sketch stays small in the note.
 */
export function mountSketchPreview(canvas: HTMLCanvasElement, sizer: HTMLElement, docId: string, onMissing: (missing: boolean) => void): () => void {
  let latest: { draw: () => void } | null = null;
  const sub = liveQuery(async () => {
    const pages = await listPages(docId);
    const page = pages[0];
    if (!page) return null;
    const strokes = (await db.strokes.where('pageId').equals(page.id).toArray()).map(fromStored);
    return { page, strokes };
  }).subscribe({
    next: (data) => {
      onMissing(!data);
      if (!data) return;
      const bottom = Math.max(0, ...data.strokes.map((s) => s.bbox[3]));
      const [box] = layoutPages([data.page], () => bottom, BLOCK_SIZE);
      latest = {
        draw: () => {
          const width = Math.max(120, sizer.clientWidth);
          const crop = { minX: 0, minY: 0, maxX: box!.w, maxY: Math.min(box!.h, Math.max(MIN_HEIGHT, bottom + MARGIN)) };
          const img = renderPageCanvas(box!, data.strokes, width, window.devicePixelRatio || 1, crop);
          canvas.width = img.width;
          canvas.height = img.height;
          canvas.style.aspectRatio = `${img.width} / ${img.height}`;
          canvas.getContext('2d')?.drawImage(img, 0, 0);
        },
      };
      latest.draw();
    },
    error: () => onMissing(true),
  });
  const ro = new ResizeObserver(() => latest?.draw());
  ro.observe(sizer);
  return () => {
    sub.unsubscribe();
    ro.disconnect();
  };
}
