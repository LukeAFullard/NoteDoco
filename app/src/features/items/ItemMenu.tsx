import { useNavigate } from 'react-router';
import { Archive, Combine, Copy, ExternalLink, FileText, FolderInput, Inbox, MoreHorizontal, Palette, Pin, PinOff, Trash2 } from 'lucide-react';
import { Menu as AriaMenu, MenuTrigger, Popover, SubmenuTrigger } from 'react-aria-components';
import type { Item } from '@/data/types';
import { useGroups } from '@/data/hooks';
import { duplicateWithUndo, moveItemsWithUndo, setArchivedWithUndo, setColourWithUndo, setPinnedWithUndo, trashItemsWithUndo } from '@/data/actions';
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
