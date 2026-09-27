import { useState, type ReactNode } from 'react';
import { Command } from 'cmdk';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  CalendarDays, CalendarRange, ChartGantt, Columns2, Columns3, FilePlus, FlaskConical, FolderPlus, Hash, Inbox, Keyboard, ListTodo, Moon, NotebookPen, Palette, Redo2, Search, Settings, StickyNote, Sun, Trash2, Undo2,
} from 'lucide-react';
import { db } from '@/data/db';
import { useGroups } from '@/data/hooks';
import { useCreate } from '@/features/capture/useCreate';
import { KIND_ICONS, itemTitle } from '@/features/items/kinds';
import { openSticky } from '@/features/stickies/stickyDialog';
import { Highlight } from '@/features/search/SearchResults';
import { useSearch } from '@/search/client';
import { openNewGroup, useUi } from './ui';
import { setTheme, useTheme } from './theme';
import { redoWithToast, undoWithToast } from './undoActions';
import { todayLocal } from '@/lib/time';

interface Cmd {
  id: string;
  label: string;
  icon: ReactNode;
  keywords?: string[];
  run: () => void;
}

/** Every word of the query must appear in the label or keywords. */
const matches = (cmd: Cmd, q: string) => {
  const hay = `${cmd.label} ${(cmd.keywords ?? []).join(' ')}`.toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
};

const itemCls = 'flex cursor-default items-center gap-2.5 rounded px-3 py-2 text-sm data-[selected=true]:bg-accent-soft';
const groupCls = 'text-xs text-muted [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5';

/**
 * Ctrl/⌘-K: go anywhere, run any action, find any note (FIND-3). Every new feature should
 * register its commands here.
 */
export function CommandPalette() {
  const open = useUi((s) => s.paletteOpen);
  const [q, setQ] = useState('');
  const groups = useGroups() ?? [];
  const theme = useTheme((s) => s.theme);
  const navigate = useNavigate();
  const create = useCreate();
  const { hits } = useSearch(q, 8);
  const recent = useLiveQuery(async () => (await db.items.orderBy('updatedAt').reverse().limit(12).toArray()).filter((i) => !i.deletedAt).slice(0, 5), []);
  const close = () => useUi.setState({ paletteOpen: false });

  const openItem = (id: string, kind: string) => {
    close();
    if (kind === 'sticky') openSticky(id);
    else navigate(`/items/${id}`);
  };

  const places: Cmd[] = [
    { id: 'today', label: 'Today', icon: <CalendarDays size={16} />, run: () => navigate('/today') },
    { id: 'inbox', label: 'Inbox', icon: <Inbox size={16} />, run: () => navigate('/inbox') },
    { id: 'timeline', label: 'Timeline', icon: <ChartGantt size={16} />, keywords: ['lanes', 'gantt', 'plan', 'schedule'], run: () => navigate('/timeline') },
    { id: 'calendar', label: 'Calendar', icon: <CalendarRange size={16} />, keywords: ['month', 'week', 'agenda'], run: () => navigate('/calendar') },
    { id: 'columns', label: 'Groups side by side', icon: <Columns3 size={16} />, keywords: ['columns', 'compare', 'kanban'], run: () => navigate('/columns') },
    { id: 'tasks', label: 'Tasks', icon: <ListTodo size={16} />, keywords: ['todo', 'to-do', 'checklist'], run: () => navigate('/tasks') },
    {
      id: 'daily',
      label: 'Today’s page',
      icon: <NotebookPen size={16} />,
      keywords: ['daily', 'journal', 'diary'],
      run: () => void import('@/data/repos/daily').then(async (m) => navigate(`/items/${await m.dailyPage(todayLocal())}`)),
    },
    { id: 'stickies', label: 'Stickies', icon: <StickyNote size={16} />, keywords: ['wall', 'post-it'], run: () => navigate('/stickies') },
    ...groups.map((g) => ({
      id: `g-${g.id}`,
      label: g.name,
      keywords: ['group'],
      icon: <span className="block h-2.5 w-2.5 rounded-full" style={{ background: `var(--sticky-${g.colour})` }} />,
      run: () => navigate(`/groups/${g.id}`),
    })),
    { id: 'search', label: 'Search', icon: <Search size={16} />, keywords: ['find'], run: () => navigate(q ? `/search?q=${encodeURIComponent(q)}` : '/search') },
    { id: 'tags', label: 'Tags', icon: <Hash size={16} />, run: () => navigate('/tags') },
    { id: 'lab', label: 'Ink lab', icon: <FlaskConical size={16} />, keywords: ['pen', 'stylus', 'draw'], run: () => navigate('/lab/ink') },
    { id: 'trash', label: 'Trash', icon: <Trash2 size={16} />, run: () => navigate('/trash') },
    { id: 'settings', label: 'Settings', icon: <Settings size={16} />, keywords: ['preferences', 'backup'], run: () => navigate('/settings') },
    { id: 'dev', label: 'Design gallery', icon: <Palette size={16} />, keywords: ['design', 'components'], run: () => navigate('/dev') },
  ];
  const actions: Cmd[] = [
    { id: 'new-note', label: 'New note', icon: <FilePlus size={16} />, run: () => void create.note() },
    { id: 'new-sticky', label: 'New sticky', icon: <StickyNote size={16} />, run: () => void create.sticky() },
    { id: 'new-group', label: 'New group', icon: <FolderPlus size={16} />, run: () => openNewGroup() },
    {
      id: 'split',
      label: 'Split view: open this beside',
      icon: <Columns2 size={16} />,
      keywords: ['pane', 'side by side', 'split'],
      run: () => void import('@/features/panes/store').then((m) => m.openPane(location.hash.slice(1) || '/today')),
    },
    { id: 'undo', label: 'Undo', icon: <Undo2 size={16} />, run: () => void undoWithToast() },
    { id: 'redo', label: 'Redo', icon: <Redo2 size={16} />, run: () => void redoWithToast() },
    {
      id: 'theme',
      label: `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`,
      icon: theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />,
      keywords: ['theme', 'dark', 'light'],
      run: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
    },
    { id: 'shortcuts', label: 'Keyboard shortcuts', icon: <Keyboard size={16} />, run: () => useUi.setState({ shortcutsOpen: true }) },
  ];

  const shownPlaces = places.filter((c) => !q || matches(c, q));
  const shownActions = actions.filter((c) => !q || matches(c, q));
  const renderCmd = (c: Cmd) => (
    <Command.Item
      key={c.id}
      value={c.id}
      onSelect={() => {
        close();
        c.run();
      }}
      className={itemCls}
    >
      <span aria-hidden className="text-muted">
        {c.icon}
      </span>
      {c.label}
    </Command.Item>
  );

  return (
    <Command.Dialog
      open={open}
      onOpenChange={(o) => useUi.setState({ paletteOpen: o })}
      label="Search and commands"
      shouldFilter={false}
      overlayClassName="fixed inset-0 z-50 bg-black/40"
      contentClassName="fixed left-1/2 top-[12vh] z-50 w-[min(560px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-panel border border-border bg-surface text-text shadow-2xl"
    >
      <Command.Input
        value={q}
        onValueChange={setQ}
        placeholder="Search notes, or type a command…"
        className="h-12 w-full border-b border-border bg-transparent px-4 text-sm outline-none placeholder:text-muted"
      />
      <Command.List className="max-h-[55vh] overflow-y-auto p-1.5">
        <Command.Empty className="px-3 py-6 text-center text-sm text-muted">No matches.</Command.Empty>
        {q && hits.length > 0 && (
          <Command.Group heading="Notes and stickies" className={groupCls}>
            {hits.map((h) => {
              const Icon = KIND_ICONS[h.kind];
              return (
                <Command.Item key={h.id} value={`item-${h.id}`} onSelect={() => openItem(h.id, h.kind)} className={itemCls}>
                  <Icon size={16} className="shrink-0 text-muted" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-text">
                      <Highlight text={itemTitle(h.title, h.kind)} terms={h.terms} />
                    </span>
                    {h.snippet && (
                      <span className="block truncate text-xs">
                        <Highlight text={h.snippet} terms={h.terms} />
                      </span>
                    )}
                  </span>
                </Command.Item>
              );
            })}
          </Command.Group>
        )}
        {!q && recent && recent.length > 0 && (
          <Command.Group heading="Recent" className={groupCls}>
            {recent.map((i) => {
              const Icon = KIND_ICONS[i.kind];
              return (
                <Command.Item key={i.id} value={`recent-${i.id}`} onSelect={() => openItem(i.id, i.kind)} className={itemCls}>
                  <Icon size={16} className="shrink-0 text-muted" aria-hidden />
                  <span className="truncate text-text">{itemTitle(i.title, i.kind)}</span>
                </Command.Item>
              );
            })}
          </Command.Group>
        )}
        {shownPlaces.length > 0 && (
          <Command.Group heading="Go to" className={groupCls}>
            {shownPlaces.map(renderCmd)}
          </Command.Group>
        )}
        {shownActions.length > 0 && (
          <Command.Group heading="Actions" className={groupCls}>
            {shownActions.map(renderCmd)}
          </Command.Group>
        )}
      </Command.List>
    </Command.Dialog>
  );
}
