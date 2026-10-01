import { useMemo } from 'react';
import { ArrowDown, ArrowUp, CopyPlus, Trash2 } from 'lucide-react';
import { Dialog } from '@/design/Dialog';
import { IconButton } from '@/design/Button';
import { toastWithUndo } from '@/app/undoActions';
import { deletePageWithUndo, duplicatePageWithUndo, movePageWithUndo } from '@/data/actions';
import type { InkEngine } from '@/canvas/engine';
import { renderPageCanvas } from '@/canvas/render';

/** Page thumbnails: go to, reorder, duplicate or delete pages (INK-9). */
export function PageSorter({ itemId, engine, layout, onClose, onGoTo }: { itemId: string; engine: InkEngine; layout: number; onClose: () => void; onGoTo: (i: number) => void }) {
  const boxes = engine.pageBoxes;
  // `layout` changes whenever the engine lays pages out again (added, moved, deleted, re-papered).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const thumbs = useMemo(() => boxes.map((b) => renderPageCanvas(b, engine.model.strokes(b.id), 120, 2).toDataURL()), [layout, engine]);
  const run = async (p: Promise<string | null>) => {
    const msg = await p;
    if (msg) toastWithUndo(msg);
  };
  return (
    <Dialog isOpen onOpenChange={(o) => !o && onClose()} title="Pages" className="sm:max-w-2xl">
      <ol className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">
        {boxes.map((b, i) => (
          <li key={b.id} className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={() => onGoTo(i)}
              className="rounded border border-border outline-none focus-visible:ring-2 focus-visible:ring-focus"
              aria-label={`Go to page ${i + 1}`}
            >
              <img src={thumbs[i]} alt="" width={120} className="block h-auto w-[120px]" />
            </button>
            <span className="text-sm text-muted">Page {i + 1}</span>
            <span className="flex">
              <IconButton label={`Move page ${i + 1} earlier`} size="sm" isDisabled={i === 0} onPress={() => void run(movePageWithUndo(itemId, b.id, boxes[i - 1]!.id))}>
                <ArrowUp size={15} />
              </IconButton>
              <IconButton label={`Move page ${i + 1} later`} size="sm" isDisabled={i === boxes.length - 1} onPress={() => void run(movePageWithUndo(itemId, b.id, boxes[i + 2]?.id ?? null))}>
                <ArrowDown size={15} />
              </IconButton>
              <IconButton label={`Duplicate page ${i + 1}`} size="sm" onPress={() => void run(duplicatePageWithUndo(itemId, b.id).then((r) => r?.label ?? null))}>
                <CopyPlus size={15} />
              </IconButton>
              <IconButton label={`Delete page ${i + 1}`} size="sm" isDisabled={boxes.length < 2} onPress={() => void run(deletePageWithUndo(itemId, b.id))}>
                <Trash2 size={15} />
              </IconButton>
            </span>
          </li>
        ))}
      </ol>
    </Dialog>
  );
}
