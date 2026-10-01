import { useLiveQuery } from 'dexie-react-hooks';
import { Dialog as AriaDialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { db } from '@/data/db';
import { Button } from '@/design/Button';
import { EmptyState } from '@/design/EmptyState';
import { closeSketch, useSketchDialog } from './sketchDialog';
import { InkSurface } from './InkEditor';

/** Draw in a sketch block (NOTE-8): the full ink editor, full screen, saved as you go. */
export function SketchDialog() {
  const docId = useSketchDialog((s) => s.docId);
  const doc = useLiveQuery(async () => (docId ? ((await db.inkDocs.get(docId)) ?? null) : null), [docId]);
  return (
    <ModalOverlay isOpen={!!docId} onOpenChange={(o) => !o && closeSketch()} className="fixed inset-0 z-50 bg-black/40">
      <Modal className="fixed inset-0 flex flex-col bg-surface text-text outline-none sm:inset-4 sm:rounded-panel sm:border sm:border-border sm:shadow-xl">
        <AriaDialog aria-label="Sketch" className="flex min-h-0 flex-1 flex-col outline-none">
          <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3">
            <Heading slot="title" className="flex-1 text-base font-semibold">
              Sketch
            </Heading>
            <Button variant="primary" size="sm" onPress={closeSketch}>
              Done
            </Button>
          </div>
          {doc === null ? (
            <EmptyState title="This sketch isn’t here" body="It may have been removed. Close this and carry on with your note." />
          ) : doc ? (
            <InkSurface key={doc.id} itemId={doc.itemId ?? ''} docId={doc.id} block />
          ) : null}
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}
