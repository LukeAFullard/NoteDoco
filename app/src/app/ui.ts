import { create } from 'zustand';

/** Ephemeral UI state shared across the shell. */
interface UiState {
  paletteOpen: boolean;
  drawerOpen: boolean;
  newGroupOpen: boolean;
  newGroupParent: string | null;
  /** The group the user is looking at (null = Inbox); new items go here. */
  currentGroupId: string | null;
  shortcutsOpen: boolean;
  dockOpen: boolean;
  /** Hides the sidebar and navigation while writing. */
  focusMode: boolean;
}

export const useUi = create<UiState>(() => ({
  paletteOpen: false,
  drawerOpen: false,
  newGroupOpen: false,
  newGroupParent: null,
  currentGroupId: null,
  shortcutsOpen: false,
  dockOpen: false,
  focusMode: false,
}));

export const openPalette = () => useUi.setState({ paletteOpen: true });
export const openNewGroup = (parentId: string | null = null) =>
  useUi.setState({ newGroupOpen: true, newGroupParent: parentId, drawerOpen: false });
export const setCurrentGroup = (currentGroupId: string | null) => useUi.setState({ currentGroupId });
