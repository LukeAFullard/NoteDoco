import { useParams, useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { FolderPlus, MoreHorizontal, Trash2, FolderOpen } from 'lucide-react';
import { db } from '@/data/db';
import { updateGroup } from '@/data/repos/groups';
import { trashGroupWithUndo } from '@/data/actions';
import { Pane } from '@/app/Pane';
import { openNewGroup } from '@/app/ui';
import { toastWithUndo } from '@/app/undoActions';
import { Menu, MenuItem } from '@/design/Menu';
import { IconButton } from '@/design/Button';
import { EmptyState } from '@/design/EmptyState';
import { ColourSwatches } from '@/design/ColourSwatches';

export function GroupPage() {
  const { groupId = '' } = useParams();
  const navigate = useNavigate();
  const group = useLiveQuery(() => db.groups.get(groupId), [groupId]);

  if (group === undefined) return null;
  if (!group || group.deletedAt) {
    return (
      <Pane title="Group not found">
        <EmptyState title="This group isn’t here" body="It may have been moved to the Trash." />
      </Pane>
    );
  }

  return (
    <Pane
      title={
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full border border-black/10" style={{ background: `var(--sticky-${group.colour})` }} />
          {group.name}
        </span>
      }
      actions={
        <Menu label="Group actions" trigger={<IconButton label="Group actions"><MoreHorizontal size={18} /></IconButton>}>
          <MenuItem onAction={() => openNewGroup(group.id)}>
            <FolderPlus size={15} aria-hidden /> New sub-group
          </MenuItem>
          <MenuItem
            danger
            onAction={async () => {
              toastWithUndo(await trashGroupWithUndo(group.id));
              navigate('/today');
            }}
          >
            <Trash2 size={15} aria-hidden /> Move to Trash
          </MenuItem>
        </Menu>
      }
    >
      <div className="border-b border-border px-4 py-3">
        <ColourSwatches label="Group colour" value={group.colour} onChange={(colour) => void updateGroup(group.id, { colour })} />
      </div>
      <EmptyState
        icon={<FolderOpen size={32} />}
        title="No notes in this group yet"
        body="Notes, stickies, handwriting and boards will live here, with List, Cards, Board, Timeline and Calendar views. Coming in Phases 1–4."
      />
    </Pane>
  );
}
