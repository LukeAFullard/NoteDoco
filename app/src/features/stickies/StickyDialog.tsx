import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarClock, FileText, Pin, PinOff, Trash2, ArrowUpRight } from 'lucide-react';
import { Dialog as AriaDialog, Modal, ModalOverlay } from 'react-aria-components';
import { db } from '@/data/db';
import { discardIfEmpty, setBodyText, setStickySize } from '@/data/repos/items';
import { setColourWithUndo, setPinnedWithUndo, trashItemsWithUndo } from '@/data/actions';
import { toastWithUndo } from '@/app/undoActions';
import { ColourSwatches } from '@/design/ColourSwatches';
import { IconButton, Button } from '@/design/Button';
import { cn } from '@/design/cn';
import { useDebouncedSave } from '@/lib/useDebouncedSave';
import { closeSticky, getRequestClose, setRequestClose, useStickyDialog } from './stickyDialog';
import { linkedNote, promoteToNote } from './promote';
import { TagEditor } from '@/features/tags/TagEditor';
import { DateBadge } from '@/features/time/DateBadge';
import { openDateDialog } from '@/app/ui';
import { resolveDateMentions } from '@/lib/dateMentions';

const SIZES = [
  { v: 'S', label: 'Small' },
  { v: 'M', label: 'Medium' },
  { v: 'L', label: 'Large' },
] as const;

/** Loads the sticky, then mounts the editor with its text (so typing never fights reloads). */
function Loader({ id, fresh }: { id: string; fresh: boolean }) {
  const initial = useLiveQuery(() => db.stickyBodies.get(id), [id]);
  if (!initial) return null;
  return <Editor id={id} fresh={fresh} initialText={initial.text} />;
}

function Editor({ id, fresh, initialText }: { id: string; fresh: boolean; initialText: string }) {
  const item = useLiveQuery(() => db.items.get(id), [id]);
  const body = useLiveQuery(() => db.stickyBodies.get(id), [id]);
  const linked = useLiveQuery(() => linkedNote(id), [id]);
  const [text, setText] = useState(initialText);
  const navigate = useNavigate();
  const { schedule, flush } = useDebouncedSave((t: string) => setBodyText(id, t));

  const done = async () => {
    const final = resolveDateMentions(text, new Date(), { final: true });
    if (final !== text) schedule(final);
    await flush();
    closeSticky();
    if (fresh) await discardIfEmpty(id);
  };
  useEffect(() => {
    setRequestClose(done);
    return () => setRequestClose(null);
  });

  if (!item || !body) return null;
  const colour = item.colour ?? 'lemon';

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      <div
        className={cn('w-full rounded-[3px] p-4 shadow-[0_2px_4px_rgba(0,0,0,0.2),0_10px_30px_rgba(0,0,0,0.25)]', body.size === 'L' ? 'max-w-md' : 'max-w-sm')}
        style={{ background: `var(--sticky-${colour})` }}
      >
        <textarea
          autoFocus
          aria-label="Sticky text"
          value={text}
          placeholder="Write something… (start a line with - [ ] for a checkbox)"
          onChange={(e) => {
            // "@fri " becomes "@2026-10-02 " as you type; keep the caret where it was.
            const el = e.target;
            const raw = el.value;
            const next = resolveDateMentions(raw);
            if (next !== raw) {
              const caret = el.selectionStart + (next.length - raw.length);
              requestAnimationFrame(() => el.setSelectionRange(caret, caret));
            }
            setText(next);
            schedule(next);
          }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void done();
          }}
          className="block min-h-48 w-full resize-none bg-transparent text-base text-sticky-ink outline-none placeholder:text-sticky-ink/50"
          style={{ fontFamily: 'var(--sticky-font)' }}
        />
      </div>
      <div className="w-full max-w-sm space-y-1.5 rounded-panel bg-surface px-3 py-2">
        <TagEditor item={item} />
        <button
          type="button"
          onClick={async () => {
            await flush();
            openDateDialog([id]);
          }}
          className="flex items-center gap-1.5 rounded text-sm text-muted outline-none hover:text-text focus-visible:ring-2 focus-visible:ring-focus"
        >
          <CalendarClock size={15} aria-hidden />
          {item.when || item.due ? <DateBadge item={item} /> : 'Add a date or reminder'}
        </button>
      </div>
      <ColourSwatches label="Sticky colour" value={colour} onChange={(c) => void setColourWithUndo([id], c)} />
      <div className="flex w-full max-w-md flex-wrap items-center justify-center gap-2">
        <div role="radiogroup" aria-label="Size" className="flex rounded-panel border border-border p-0.5">
          {SIZES.map((s) => (
            <button
              key={s.v}
              type="button"
              role="radio"
              aria-checked={body.size === s.v}
              aria-label={s.label}
              onClick={() => void setStickySize(id, s.v)}
              className={cn('h-8 w-9 rounded font-mono text-xs', body.size === s.v ? 'bg-accent-soft text-accent' : 'text-muted')}
            >
              {s.v}
            </button>
          ))}
        </div>
        <IconButton label={item.pinned ? 'Unpin' : 'Pin to the dock'} onPress={async () => toastWithUndo(await setPinnedWithUndo([id], !item.pinned))}>
          {item.pinned ? <PinOff size={18} /> : <Pin size={18} />}
        </IconButton>
        {linked ? (
          <Button size="sm" variant="ghost" onPress={async () => { await flush(); closeSticky(); navigate(`/items/${linked}`); }}>
            <ArrowUpRight size={15} aria-hidden /> Open its note
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            isDisabled={!text.trim()}
            onPress={async () => {
              await flush();
              const noteId = await promoteToNote(id);
              closeSticky();
              navigate(`/items/${noteId}`);
            }}
          >
            <FileText size={15} aria-hidden /> Make it a note
          </Button>
        )}
        <IconButton
          label="Move to Trash"
          variant="danger"
          onPress={async () => {
            await flush();
            closeSticky();
            if (!(fresh && (await discardIfEmpty(id)))) toastWithUndo(await trashItemsWithUndo([id]));
          }}
        >
          <Trash2 size={18} />
        </IconButton>
        <Button size="sm" variant="primary" onPress={() => void done()}>
          Done
        </Button>
      </div>
    </div>
  );
}

/** Edit one sticky, big, from anywhere. Closing a brand-new empty sticky discards it. */
export function StickyDialog() {
  const { id, fresh } = useStickyDialog();
  return (
    <ModalOverlay
      isOpen={!!id}
      onOpenChange={(open) => {
        if (open || !id) return;
        const close = getRequestClose();
        if (close) void close();
        else closeSticky();
      }}
      isDismissable
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 pt-[8vh]"
    >
      <Modal className="w-full max-w-lg outline-none">
        <AriaDialog aria-label="Edit sticky" className="outline-none">
          {id && <Loader key={id} id={id} fresh={fresh} />}
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}
