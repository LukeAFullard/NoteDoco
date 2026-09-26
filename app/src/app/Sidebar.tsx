import { useState, type DragEvent, type ReactNode } from 'react';
import { NavLink } from 'react-router';
import { CalendarDays, FlaskConical, Hash, Inbox, Plus, Search, Settings, StickyNote, Trash2 } from 'lucide-react';
import { useGroupTree } from '@/data/hooks';
import type { GroupNode } from '@/data/repos/groups';
import { moveGroupWithUndo, moveItemsWithUndo } from '@/data/actions';
import { LazyNewMenu as NewMenu } from '@/features/capture/LazyNewMenu';
import { Button } from '@/design/Button';
import { Kbd } from '@/design/Kbd';
import { showToast } from '@/design/toast';
import { cn } from '@/design/cn';
import { DRAG_GROUP, canDrag, dragKind, dropZone, readDragItems, setDragGroup } from '@/lib/dnd';
import { toastWithUndo } from './undoActions';
import { openNewGroup, openPalette, useUi } from './ui';

const closeDrawer = () => useUi.setState({ drawerOpen: false });

function NavItem({ to, icon, children, onDrop }: { to: string; icon: ReactNode; children: ReactNode; onDrop?: (e: DragEvent) => void }) {
  const [over, setOver] = useState(false);
  return (
    <NavLink
      to={to}
      onClick={closeDrawer}
      onDragOver={
        onDrop &&
        ((e) => {
          if (dragKind(e) !== 'items') return;
          e.preventDefault();
          setOver(true);
        })
      }
      onDragLeave={() => setOver(false)}
      onDrop={
        onDrop &&
        ((e) => {
          e.preventDefault();
          setOver(false);
          onDrop(e);
        })
      }
      className={({ isActive }) =>
        cn(
          'flex h-9 items-center gap-2.5 rounded-panel px-2.5 text-sm',
          isActive ? 'bg-accent-soft font-medium text-accent' : 'text-text hover:bg-surface-2',
          over && 'ring-2 ring-focus',
        )
      }
    >
      <span aria-hidden className="shrink-0">
        {icon}
      </span>
      <span className="truncate">{children}</span>
    </NavLink>
  );
}

interface Row {
  node: GroupNode;
  depth: number;
  /** The next sibling's id, for "drop after this row". */
  nextSiblingId: string | null;
}

function flatten(nodes: GroupNode[], showArchived: boolean, depth = 0, out: Row[] = []): Row[] {
  const visible = nodes.filter((n) => showArchived || !n.group.archived);
  visible.forEach((node, i) => {
    out.push({ node, depth, nextSiblingId: visible[i + 1]?.group.id ?? null });
    flatten(node.children, showArchived, depth + 1, out);
  });
  return out;
}

type Target = { id: string; zone: 'before' | 'inside' | 'after' } | null;

function GroupRows({ rows }: { rows: Row[] }) {
  const [target, setTarget] = useState<Target>(null);
  const draggable = canDrag();

  const onDrop = async (e: DragEvent, row: Row, zone: 'before' | 'inside' | 'after') => {
    const g = row.node.group;
    if (dragKind(e) === 'items') {
      const ids = readDragItems(e);
      if (ids.length) toastWithUndo(await moveItemsWithUndo(ids, g.id));
      return;
    }
    const dragged = e.dataTransfer.getData(DRAG_GROUP);
    if (!dragged || dragged === g.id) return;
    try {
      if (zone === 'inside') toastWithUndo(await moveGroupWithUndo(dragged, g.id));
      else if (zone === 'before') toastWithUndo(await moveGroupWithUndo(dragged, g.parentId, g.id));
      else toastWithUndo(await moveGroupWithUndo(dragged, g.parentId, row.nextSiblingId === dragged ? null : row.nextSiblingId));
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Couldn’t move that group', tone: 'danger' }, 4000);
    }
  };

  return (
    <ul aria-label="Groups">
      {rows.map((row) => {
        const g = row.node.group;
        const t = target?.id === g.id ? target.zone : null;
        return (
          <li
            key={g.id}
            draggable={draggable}
            onDragStart={(e) => setDragGroup(e, g.id)}
            onDragOver={(e) => {
              const kind = dragKind(e);
              if (!kind) return;
              e.preventDefault();
              setTarget({ id: g.id, zone: kind === 'items' ? 'inside' : dropZone(e, e.currentTarget) });
            }}
            onDragLeave={() => setTarget(null)}
            onDrop={(e) => {
              e.preventDefault();
              const zone = target?.zone ?? 'inside';
              setTarget(null);
              void onDrop(e, row, zone);
            }}
            className={cn('relative rounded-panel', t === 'inside' && 'ring-2 ring-focus')}
            style={{ paddingLeft: row.depth * 14 }}
          >
            {t === 'before' && <span className="absolute inset-x-0 -top-px h-0.5 bg-focus" />}
            {t === 'after' && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-focus" />}
            <NavItem
              to={`/groups/${g.id}`}
              icon={<span className="block h-2.5 w-2.5 rounded-full border border-black/10" style={{ background: `var(--sticky-${g.colour})` }} />}
            >
              <span className={cn(g.archived && 'text-muted italic')}>
                {g.icon ? `${g.icon} ` : ''}
                {g.name}
              </span>
            </NavItem>
          </li>
        );
      })}
    </ul>
  );
}

export function Sidebar() {
  const tree = useGroupTree();
  const [showArchived, setShowArchived] = useState(false);
  const archivedCount = tree ? flatten(tree, true).filter((r) => r.node.group.archived).length : 0;
  const rows = tree ? flatten(tree, showArchived) : [];

  return (
    <nav aria-label="Main" className="flex h-full w-64 flex-col border-r border-border bg-bg">
      <div className="flex h-14 items-center justify-between px-4">
        <span className="text-lg font-bold">
          Note<span className="text-accent">Doco</span>
          <span className="ml-2 rounded bg-accent-soft px-1.5 py-0.5 align-middle font-mono text-[10px] text-accent">v2 alpha</span>
        </span>
      </div>
      <div className="flex gap-2 px-3 pb-3">
        <NewMenu className="flex-1" />
        <Button variant="secondary" size="sm" onPress={openPalette} aria-label="Search and commands">
          <Search size={15} aria-hidden /> <Kbd>⌘K</Kbd>
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto px-3">
        <NavItem to="/today" icon={<CalendarDays size={16} />}>
          Today
        </NavItem>
        <NavItem
          to="/inbox"
          icon={<Inbox size={16} />}
          onDrop={async (e) => {
            const ids = readDragItems(e);
            if (ids.length) toastWithUndo(await moveItemsWithUndo(ids, null));
          }}
        >
          Inbox
        </NavItem>
        <NavItem to="/stickies" icon={<StickyNote size={16} />}>
          Stickies
        </NavItem>
        <div
          className="mt-5 mb-1 flex items-center justify-between px-2.5"
          onDragOver={(e) => dragKind(e) === 'group' && e.preventDefault()}
          onDrop={async (e) => {
            const id = e.dataTransfer.getData(DRAG_GROUP);
            if (id) toastWithUndo(await moveGroupWithUndo(id, null));
          }}
        >
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Groups</span>
          <button type="button" aria-label="New group" className="text-muted hover:text-accent" onClick={() => openNewGroup()}>
            <Plus size={15} />
          </button>
        </div>
        {rows.length > 0 ? <GroupRows rows={rows} /> : <p className="px-2.5 py-1 text-sm text-muted">No groups yet.</p>}
        {archivedCount > 0 && (
          <button type="button" onClick={() => setShowArchived(!showArchived)} className="mt-1 px-2.5 text-xs text-muted hover:text-text">
            {showArchived ? 'Hide archived' : `Show archived (${archivedCount})`}
          </button>
        )}
      </div>
      <div className="border-t border-border p-3">
        <NavItem to="/lab/ink" icon={<FlaskConical size={16} />}>
          Ink lab
        </NavItem>
        <NavItem to="/tags" icon={<Hash size={16} />}>
          Tags
        </NavItem>
        <NavItem to="/trash" icon={<Trash2 size={16} />}>
          Trash
        </NavItem>
        <NavItem to="/settings" icon={<Settings size={16} />}>
          Settings
        </NavItem>
      </div>
    </nav>
  );
}
