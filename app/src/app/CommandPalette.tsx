import { Command } from 'cmdk';
import { useNavigate } from 'react-router';
import { CalendarDays, FilePlus, FlaskConical, FolderPlus, Inbox, Keyboard, Moon, Palette, Redo2, Settings, StickyNote, Sun, Trash2, Undo2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useGroups } from '@/data/hooks';
import { openNewGroup, useUi } from './ui';
import { setTheme, useTheme } from './theme';
import { redoWithToast, undoWithToast } from './undoActions';
import { useCreate } from '@/features/capture/useCreate';

function Item({ onSelect, icon, children, keywords }: { onSelect: () => void; icon: ReactNode; children: ReactNode; keywords?: string[] }) {
  return (
    <Command.Item
      onSelect={onSelect}
      keywords={keywords}
      className="flex cursor-default items-center gap-2.5 rounded px-3 py-2 text-sm data-[selected=true]:bg-accent-soft"
    >
      <span aria-hidden className="text-muted">
        {icon}
      </span>
      {children}
    </Command.Item>
  );
}

/** Ctrl/⌘-K: go anywhere, run any action. Every new feature should register its commands here. */
export function CommandPalette() {
  const open = useUi((s) => s.paletteOpen);
  const groups = useGroups() ?? [];
  const theme = useTheme((s) => s.theme);
  const navigate = useNavigate();
  const create = useCreate();
  const close = () => useUi.setState({ paletteOpen: false });
  const run = (fn: () => void) => () => {
    close();
    fn();
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={(o) => useUi.setState({ paletteOpen: o })}
      label="Search and commands"
      overlayClassName="fixed inset-0 z-50 bg-black/40"
      contentClassName="fixed left-1/2 top-[12vh] z-50 w-[min(560px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-panel border border-border bg-surface text-text shadow-2xl"
    >
      <Command.Input
        placeholder="Type a command or search…"
        className="h-12 w-full border-b border-border bg-transparent px-4 text-sm outline-none placeholder:text-muted"
      />
      <Command.List className="max-h-[50vh] overflow-y-auto p-1.5">
        <Command.Empty className="px-3 py-6 text-center text-sm text-muted">No matches.</Command.Empty>
        <Command.Group heading="Go to" className="text-xs text-muted [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5">
          <Item icon={<CalendarDays size={16} />} onSelect={run(() => navigate('/today'))}>
            Today
          </Item>
          <Item icon={<Inbox size={16} />} onSelect={run(() => navigate('/inbox'))}>
            Inbox
          </Item>
          <Item icon={<StickyNote size={16} />} onSelect={run(() => navigate('/stickies'))} keywords={['wall', 'post-it']}>
            Stickies
          </Item>
          {groups.map((g) => (
            <Item
              key={g.id}
              icon={<span className="block h-2.5 w-2.5 rounded-full" style={{ background: `var(--sticky-${g.colour})` }} />}
              onSelect={run(() => navigate(`/groups/${g.id}`))}
              keywords={['group']}
            >
              {g.name}
            </Item>
          ))}
          <Item icon={<FlaskConical size={16} />} onSelect={run(() => navigate('/lab/ink'))} keywords={['pen', 'stylus', 'draw']}>
            Ink lab
          </Item>
          <Item icon={<Trash2 size={16} />} onSelect={run(() => navigate('/trash'))}>
            Trash
          </Item>
          <Item icon={<Settings size={16} />} onSelect={run(() => navigate('/settings'))}>
            Settings
          </Item>
          <Item icon={<Palette size={16} />} onSelect={run(() => navigate('/dev'))} keywords={['design', 'components', 'gallery']}>
            Design gallery
          </Item>
        </Command.Group>
        <Command.Group heading="Actions" className="text-xs text-muted [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5">
          <Item icon={<FilePlus size={16} />} onSelect={run(() => void create.note())}>
            New note
          </Item>
          <Item icon={<StickyNote size={16} />} onSelect={run(() => void create.sticky())}>
            New sticky
          </Item>
          <Item icon={<FolderPlus size={16} />} onSelect={run(() => openNewGroup())}>
            New group
          </Item>
          <Item icon={<Keyboard size={16} />} onSelect={run(() => useUi.setState({ shortcutsOpen: true }))}>
            Keyboard shortcuts
          </Item>
          <Item icon={<Undo2 size={16} />} onSelect={run(() => void undoWithToast())}>
            Undo
          </Item>
          <Item icon={<Redo2 size={16} />} onSelect={run(() => void redoWithToast())}>
            Redo
          </Item>
          <Item
            icon={theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            onSelect={run(() => setTheme(theme === 'dark' ? 'light' : 'dark'))}
            keywords={['theme', 'dark', 'light']}
          >
            Switch to {theme === 'dark' ? 'light' : 'dark'} theme
          </Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
