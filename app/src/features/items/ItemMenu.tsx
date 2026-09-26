import { useNavigate } from 'react-router';
import {
  Archive, CalendarClock, CalendarPlus, CheckCircle2, Circle, Combine, Copy, Download, ExternalLink, FileText, FolderInput, Inbox, ListTodo, MoreHorizontal, Palette, Pin, PinOff, Trash2,
} from 'lucide-react';
import { Menu as AriaMenu, MenuTrigger, Popover, SubmenuTrigger } from 'react-aria-components';
import type { Item } from '@/data/types';
import { useGroups } from '@/data/hooks';
import {
  completeWithUndo, duplicateWithUndo, moveItemsWithUndo, setArchivedWithUndo, setColourWithUndo, setPinnedWithUndo, setTimeWithUndo, toggleDoneWithUndo, trashItemsWithUndo,
} from '@/data/actions';
import { openDateDialog } from '@/app/ui';
import { parseRule } from '@/lib/recurrence';
import { openSticky } from '@/features/stickies/stickyDialog';
import { toastWithUndo } from '@/app/undoActions';
import { IconButton } from '@/design/Button';
import { MenuItem } from '@/design/Menu';
import { COLOUR_KEYS, COLOUR_LABELS } from '@/lib/palette';
import { mergeIntoNote, promoteToNote } from '@/features/stickies/promote';

const popover = 'min-w-52 max-h-[60vh] overflow-auto rounded-panel border border-border bg-surface p-1 shadow-lg outline-none';

/** Actions for one item, or for the whole selection when `ids` has several. */
export function ItemActionsMenu({ items, onOpen, triggerLabel = 'Item actions' }: { items: Item[]; onOpen?: () => void; triggerLabel?: string }) {
  const groups = useGroups() ?? [];
  const navigate = useNavigate();
  const ids = items.map((i) => i.id);
  const single = items.length === 1 ? items[0]! : null;
  const allPinned = items.every((i) => i.pinned);
  const run = async (p: Promise<string>) => toastWithUndo(await p);

  return (
    <MenuTrigger>
      <IconButton label={triggerLabel} size="sm">
        <MoreHorizontal size={16} />
      </IconButton>
      <Popover className={popover} placement="bottom end">
        <AriaMenu aria-label={triggerLabel} className="outline-none">
          {single && onOpen && (
            <MenuItem onAction={onOpen}>
              <ExternalLink size={15} aria-hidden /> Open
            </MenuItem>
          )}
          <MenuItem onAction={() => openDateDialog(ids)}>
            <CalendarClock size={15} aria-hidden /> Date and repeat…
          </MenuItem>
          {single && parseRule(single.recurrence)?.mode === 'copy' && (single.when || single.due) ? (
            <MenuItem
              onAction={async () => {
                const { label, result } = await completeWithUndo(single.id);
                toastWithUndo(label);
                if (result.kind === 'copied') {
                  if (single.kind === 'sticky') openSticky(result.copyId);
                  else navigate(`/items/${result.copyId}`);
                }
              }}
            >
              <CheckCircle2 size={15} aria-hidden /> Start a fresh copy
            </MenuItem>
          ) : single?.task ? (
            <MenuItem onAction={() => run(toggleDoneWithUndo(single.id))}>
              {single.task.done ? <Circle size={15} aria-hidden /> : <CheckCircle2 size={15} aria-hidden />} {single.task.done ? 'Mark not done' : 'Mark done'}
            </MenuItem>
          ) : (
            items.some((i) => !i.task) && (
              <MenuItem onAction={() => run(setTimeWithUndo(ids.filter((id) => !items.find((i) => i.id === id)!.task), { task: { done: false, doneAt: null } }, items.length > 1 ? 'Now to-dos' : 'Now a to-do'))}>
                <ListTodo size={15} aria-hidden /> Make {items.length > 1 ? 'them to-dos' : 'it a to-do'}
              </MenuItem>
            )
          )}
          <MenuItem onAction={() => run(setPinnedWithUndo(ids, !allPinned))}>
            {allPinned ? <PinOff size={15} aria-hidden /> : <Pin size={15} aria-hidden />} {allPinned ? 'Unpin' : 'Pin'}
          </MenuItem>
          <SubmenuTrigger>
            <MenuItem>
              <FolderInput size={15} aria-hidden /> Move to…
            </MenuItem>
            <Popover className={popover}>
              <AriaMenu aria-label="Move to group" className="outline-none">
                <MenuItem onAction={() => run(moveItemsWithUndo(ids, null))}>
                  <Inbox size={15} aria-hidden /> Inbox
                </MenuItem>
                {groups.map((g) => (
                  <MenuItem key={g.id} onAction={() => run(moveItemsWithUndo(ids, g.id))}>
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: `var(--sticky-${g.colour})` }} />
                    {g.icon ? `${g.icon} ` : ''}
                    {g.name}
                  </MenuItem>
                ))}
              </AriaMenu>
            </Popover>
          </SubmenuTrigger>
          <SubmenuTrigger>
            <MenuItem>
              <Palette size={15} aria-hidden /> Colour
            </MenuItem>
            <Popover className={popover}>
              <AriaMenu aria-label="Colour" className="outline-none">
                {COLOUR_KEYS.map((c) => (
                  <MenuItem key={c} onAction={() => run(setColourWithUndo(ids, c))}>
                    <span className="h-3 w-3 rounded-full border border-black/10" style={{ background: `var(--sticky-${c})` }} />
                    {COLOUR_LABELS[c]}
                  </MenuItem>
                ))}
                <MenuItem onAction={() => run(setColourWithUndo(ids, null))}>No colour</MenuItem>
              </AriaMenu>
            </Popover>
          </SubmenuTrigger>
          {single && (
            <MenuItem
              onAction={async () => {
                const { id, label } = await duplicateWithUndo(single.id);
                toastWithUndo(label);
                if (single.kind === 'note') navigate(`/items/${id}`);
              }}
            >
              <Copy size={15} aria-hidden /> Duplicate
            </MenuItem>
          )}
          {single && (single.when || single.due) && (
            <MenuItem
              onAction={async () => {
                const [{ toIcs, icsFileName }, { download }] = await Promise.all([import('@/lib/ics'), import('@/backup/backup')]);
                download(new Blob([toIcs([single])], { type: 'text/calendar' }), icsFileName(single.title));
              }}
            >
              <CalendarPlus size={15} aria-hidden /> Add to calendar (.ics)
            </MenuItem>
          )}
          {single?.kind === 'note' && (
            <MenuItem
              onAction={async () => {
                const [{ exportNote }, { download }] = await Promise.all([import('@/backup/markdown'), import('@/backup/backup')]);
                const out = await exportNote(single.id);
                download(out.blob, out.name);
              }}
            >
              <Download size={15} aria-hidden /> Export as {'Markdown'}
            </MenuItem>
          )}
          {single?.kind === 'sticky' && (
            <MenuItem onAction={async () => navigate(`/items/${await promoteToNote(single.id)}`)}>
              <FileText size={15} aria-hidden /> Make it a note
            </MenuItem>
          )}
          {items.length > 1 && items.every((i) => i.kind === 'sticky') && (
            <MenuItem onAction={async () => navigate(`/items/${await mergeIntoNote(ids)}`)}>
              <Combine size={15} aria-hidden /> Merge into one note
            </MenuItem>
          )}
          <MenuItem onAction={() => run(setArchivedWithUndo(ids, !items.every((i) => i.archived)))}>
            <Archive size={15} aria-hidden /> {items.every((i) => i.archived) ? 'Unarchive' : 'Archive'}
          </MenuItem>
          <MenuItem danger onAction={() => run(trashItemsWithUndo(ids))}>
            <Trash2 size={15} aria-hidden /> Move to Trash
          </MenuItem>
        </AriaMenu>
      </Popover>
    </MenuTrigger>
  );
}
