import { NavLink } from 'react-router';
import { CalendarDays, FlaskConical, Inbox, Plus, Search, Settings, StickyNote, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useGroupTree } from '@/data/hooks';
import type { GroupNode } from '@/data/repos/groups';
import { NewMenu } from '@/features/capture/NewMenu';
import { Button } from '@/design/Button';
import { Kbd } from '@/design/Kbd';
import { cn } from '@/design/cn';
import { openNewGroup, openPalette, useUi } from './ui';

const closeDrawer = () => useUi.setState({ drawerOpen: false });

function NavItem({ to, icon, children }: { to: string; icon: ReactNode; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      onClick={closeDrawer}
      className={({ isActive }) =>
        cn(
          'flex h-9 items-center gap-2.5 rounded-panel px-2.5 text-sm',
          isActive ? 'bg-accent-soft font-medium text-accent' : 'text-text hover:bg-surface-2',
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

function GroupTree({ nodes, depth = 0 }: { nodes: GroupNode[]; depth?: number }) {
  return (
    <ul role={depth === 0 ? 'tree' : 'group'} aria-label={depth === 0 ? 'Groups' : undefined}>
      {nodes.map(({ group, children }) => (
        <li key={group.id} role="treeitem" aria-expanded={children.length ? true : undefined}>
          <div style={{ paddingLeft: depth * 14 }}>
            <NavItem
              to={`/groups/${group.id}`}
              icon={
                <span
                  className="block h-2.5 w-2.5 rounded-full border border-black/10"
                  style={{ background: `var(--sticky-${group.colour})` }}
                />
              }
            >
              {group.icon ? `${group.icon} ` : ''}
              {group.name}
            </NavItem>
          </div>
          {children.length > 0 && <GroupTree nodes={children} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  );
}

export function Sidebar() {
  const tree = useGroupTree();
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
        <NavItem to="/inbox" icon={<Inbox size={16} />}>
          Inbox
        </NavItem>
        <NavItem to="/stickies" icon={<StickyNote size={16} />}>
          Stickies
        </NavItem>
        <div className="mt-5 mb-1 flex items-center justify-between px-2.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Groups</span>
          <button type="button" aria-label="New group" className="text-muted hover:text-accent" onClick={() => openNewGroup()}>
            <Plus size={15} />
          </button>
        </div>
        {tree && tree.length > 0 ? (
          <GroupTree nodes={tree} />
        ) : (
          <p className="px-2.5 py-1 text-sm text-muted">No groups yet.</p>
        )}
      </div>
      <div className="border-t border-border p-3">
        <NavItem to="/lab/ink" icon={<FlaskConical size={16} />}>
          Ink lab
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
