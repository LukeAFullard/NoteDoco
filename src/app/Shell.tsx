import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import { CalendarDays, Inbox, Menu as MenuIcon, Search } from 'lucide-react';
import type { ReactNode } from 'react';
import { Toaster } from '@/design/Toaster';
import { cn } from '@/design/cn';
import { Sidebar } from './Sidebar';
import { InstallGuide, StorageBanner } from './Banners';
import { openPalette, useUi } from './ui';
import { LazyNewMenu as NewMenu } from '@/features/capture/LazyNewMenu';
import { useCreate } from '@/features/capture/useCreate';
import { useStickyDialog } from '@/features/stickies/stickyDialog';
import { useGlobalShortcuts } from './shortcuts';
import { useMissed } from '@/features/reminders/store';
import { maxExtraPanes, setActivePane, usePanes } from '@/features/panes/store';

function useWindowWidth() {
  const [width, setWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const on = () => setWidth(window.innerWidth);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return width;
}

/** A thin accent line on the pane you're using, when there's more than one. */
function ActiveMark({ show }: { show: boolean }) {
  return show ? <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-40 h-0.5 bg-accent-fill" /> : null;
}

/** Starts reminders once the app has settled, and opens items from notification clicks. */
function useReminders() {
  useEffect(() => {
    const start = () => void import('@/features/reminders/scheduler').then((m) => m.startReminders());
    const timer = window.setTimeout(start, 1500);
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'notedoco:open' && typeof e.data.hash === 'string') location.hash = e.data.hash;
    };
    navigator.serviceWorker?.addEventListener('message', onMessage);
    return () => {
      clearTimeout(timer);
      navigator.serviceWorker?.removeEventListener('message', onMessage);
    };
  }, []);
}

// Loaded on first use to keep the startup bundle small.
const CommandPalette = lazy(() => import('./CommandPalette').then((m) => ({ default: m.CommandPalette })));
const NewGroupDialog = lazy(() => import('./NewGroupDialog').then((m) => ({ default: m.NewGroupDialog })));
const ShortcutsDialog = lazy(() => import('./ShortcutsDialog').then((m) => ({ default: m.ShortcutsDialog })));
const BackupReminder = lazy(() => import('./BackupReminder').then((m) => ({ default: m.BackupReminder })));
const StickyDialog = lazy(() => import('@/features/stickies/StickyDialog').then((m) => ({ default: m.StickyDialog })));
const DateDialog = lazy(() => import('@/features/time/DateDialog').then((m) => ({ default: m.DateDialog })));
const ExtraPane = lazy(() => import('@/features/panes/ExtraPane').then((m) => ({ default: m.ExtraPane })));
const MissedDialog = lazy(() => import('@/features/reminders/MissedDialog').then((m) => ({ default: m.MissedDialog })));
const StickyDock = lazy(() => import('@/features/stickies/StickyDock').then((m) => ({ default: m.StickyDock })));

function BottomTab({ to, onPress, icon, label }: { to?: string; onPress?: () => void; icon: ReactNode; label: string }) {
  const cls = 'flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px]';
  if (to) {
    return (
      <NavLink to={to} className={({ isActive }) => cn(cls, isActive ? 'text-accent' : 'text-muted')}>
        {icon}
        {label}
      </NavLink>
    );
  }
  return (
    <button type="button" onClick={onPress} className={cn(cls, 'text-muted')}>
      {icon}
      {label}
    </button>
  );
}

export function Shell() {
  const create = useCreate();
  const actions = useMemo(
    () => ({ newNote: () => void create.note(), newSticky: () => void create.sticky(), showShortcuts: () => useUi.setState({ shortcutsOpen: true }) }),
    [create],
  );
  useGlobalShortcuts(actions);
  useReminders();
  const missedCount = useMissed((s) => s.missed.length);
  const drawerOpen = useUi((s) => s.drawerOpen);
  const focusMode = useUi((s) => s.focusMode);
  const width = useWindowWidth();
  const allPanes = usePanes((s) => s.panes);
  const activePane = usePanes((s) => s.active);
  const panes = focusMode ? [] : allPanes.slice(0, maxExtraPanes(width));
  const shortcutsOpen = useUi((s) => s.shortcutsOpen);
  const stickyOpen = useStickyDialog((s) => s.id !== null);
  const paletteOpen = useUi((s) => s.paletteOpen);
  const newGroupOpen = useUi((s) => s.newGroupOpen);
  const dateDialogOpen = useUi((s) => s.dateDialogIds !== null);

  return (
    <div className="flex h-full flex-col">
      <StorageBanner />
      <InstallGuide />
      <Suspense>
        <BackupReminder />
      </Suspense>
      <div className="flex min-h-0 flex-1">
        {!focusMode && (
          <div className="hidden md:block">
            <Sidebar />
          </div>
        )}

        {drawerOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => useUi.setState({ drawerOpen: false })} />
            <div className="absolute inset-y-0 left-0 max-w-[85vw] shadow-xl">
              <Sidebar />
            </div>
          </div>
        )}

        <main className={cn('flex min-w-0 flex-1 bg-surface', !focusMode && 'pb-16 md:pb-0')}>
          <div data-pane-id="main" className="relative flex min-w-0 flex-1" onPointerDownCapture={() => setActivePane('main')} onFocusCapture={() => setActivePane('main')}>
            <ActiveMark show={panes.length > 0 && activePane === 'main'} />
            <Suspense fallback={<div className="p-6 text-sm text-muted">Loading…</div>}>
              <Outlet />
            </Suspense>
          </div>
          {/* Side by side (WS-1): more panes, each with its own history. */}
          {panes.map((p) => (
            <div key={p.id} className="relative flex min-w-0 flex-1 border-l border-border">
              <ActiveMark show={activePane === p.id} />
              <Suspense fallback={<div className="p-6 text-sm text-muted">Loading…</div>}>
                <ExtraPane pane={p} />
              </Suspense>
            </div>
          ))}
        </main>
      </div>

      {/* Phone navigation. */}
      <nav
        aria-label="Quick navigation"
        hidden={focusMode}
        className="fixed inset-x-0 bottom-0 z-30 flex h-16 border-t border-border bg-bg pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <BottomTab to="/today" icon={<CalendarDays size={20} />} label="Today" />
        <BottomTab to="/inbox" icon={<Inbox size={20} />} label="Inbox" />
        <div className="flex flex-1 items-center justify-center">
          <NewMenu compact className="!h-11 !w-11 !rounded-full shadow-lg" />
        </div>
        <BottomTab onPress={openPalette} icon={<Search size={20} />} label="Search" />
        <BottomTab onPress={() => useUi.setState({ drawerOpen: true })} icon={<MenuIcon size={20} />} label="Menu" />
      </nav>

      <Suspense>
        {paletteOpen && <CommandPalette />}
        {newGroupOpen && <NewGroupDialog />}
        {shortcutsOpen && <ShortcutsDialog />}
        {!focusMode && <StickyDock />}
        {stickyOpen && <StickyDialog />}
        {dateDialogOpen && <DateDialog />}
        {missedCount > 0 && <MissedDialog />}
      </Suspense>
      <Toaster />
    </div>
  );
}
