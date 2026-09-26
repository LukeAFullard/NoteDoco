import { Suspense, lazy, useMemo } from 'react';
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

// Loaded on first use to keep the startup bundle small.
const CommandPalette = lazy(() => import('./CommandPalette').then((m) => ({ default: m.CommandPalette })));
const NewGroupDialog = lazy(() => import('./NewGroupDialog').then((m) => ({ default: m.NewGroupDialog })));
const ShortcutsDialog = lazy(() => import('./ShortcutsDialog').then((m) => ({ default: m.ShortcutsDialog })));
const BackupReminder = lazy(() => import('./BackupReminder').then((m) => ({ default: m.BackupReminder })));
const StickyDialog = lazy(() => import('@/features/stickies/StickyDialog').then((m) => ({ default: m.StickyDialog })));
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
  const drawerOpen = useUi((s) => s.drawerOpen);
  const focusMode = useUi((s) => s.focusMode);
  const shortcutsOpen = useUi((s) => s.shortcutsOpen);
  const stickyOpen = useStickyDialog((s) => s.id !== null);
  const paletteOpen = useUi((s) => s.paletteOpen);
  const newGroupOpen = useUi((s) => s.newGroupOpen);

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
          <Suspense fallback={<div className="p-6 text-sm text-muted">Loading…</div>}>
            <Outlet />
          </Suspense>
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
      </Suspense>
      <Toaster />
    </div>
  );
}
