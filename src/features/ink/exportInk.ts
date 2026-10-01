import { showToast } from '@/design/toast';

export type InkExport = 'pdf' | 'svg' | 'png' | 'print';

/** Exports or prints an ink note (or a sketch). The export code loads only when used. */
export async function exportInk(kind: InkExport, itemId: string, opts: { docId?: string; page?: number } = {}) {
  try {
    const [ex, { download }, { safeFileName }] = await Promise.all([import('@/canvas/export'), import('@/backup/backup'), import('@/backup/markdown')]);
    const doc = await ex.loadExportDoc(itemId, opts.docId);
    const name = safeFileName(doc.title);
    if (kind === 'pdf') download(await ex.toPdf(doc), `${name}.pdf`);
    else if (kind === 'svg') download(new Blob([await ex.toSvg(doc)], { type: 'image/svg+xml' }), `${name}.svg`);
    else if (kind === 'png') download(await ex.pagePng(doc, opts.page ?? 0), `${name}${doc.boxes.length > 1 ? ` page ${(opts.page ?? 0) + 1}` : ''}.png`);
    else await ex.printDoc(doc);
  } catch (err) {
    console.error(err);
    showToast({ message: `That didn’t work: ${err instanceof Error ? err.message : String(err)}`, tone: 'danger' });
  }
}
