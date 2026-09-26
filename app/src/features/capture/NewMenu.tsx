import { FilePlus, FolderPlus, Plus, StickyNote } from 'lucide-react';
import { Menu, MenuItem } from '@/design/Menu';
import { Button } from '@/design/Button';
import { Kbd } from '@/design/Kbd';
import { openNewGroup, useUi } from '@/app/ui';
import { useCreate } from './useCreate';

/** The "+ New" menu: note, sticky, group. */
export function NewMenu({ className, compact }: { className?: string; compact?: boolean }) {
  const create = useCreate();
  return (
    <Menu
      label="Create"
      trigger={
        <Button variant="primary" size="sm" className={className} aria-label="New">
          <Plus size={16} aria-hidden /> {!compact && 'New'}
        </Button>
      }
    >
      <MenuItem onAction={() => void create.note()}>
        <FilePlus size={15} aria-hidden /> <span className="flex-1">Note</span> <Kbd>N</Kbd>
      </MenuItem>
      <MenuItem onAction={() => void create.sticky()}>
        <StickyNote size={15} aria-hidden /> <span className="flex-1">Sticky</span> <Kbd>S</Kbd>
      </MenuItem>
      <MenuItem onAction={() => openNewGroup(useUi.getState().currentGroupId)}>
        <FolderPlus size={15} aria-hidden /> <span className="flex-1">Group</span>
      </MenuItem>
    </Menu>
  );
}
