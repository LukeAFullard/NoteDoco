import { create } from 'zustand';

/** Ephemeral UI state shared across the shell. */
interface UiState {
  paletteOpen: boolean;
  drawerOpen: boolean;
  newGroupOpen: boolean;
  newGroupParent: string | null;
}

export const useUi = create<UiState>(() => ({
  paletteOpen: false,
  drawerOpen: false,
  newGroupOpen: false,
  newGroupParent: null,
}));

export const openPalette = () => useUi.setState({ paletteOpen: true });
export const openNewGroup = (parentId: string | null = null) =>
  useUi.setState({ newGroupOpen: true, newGroupParent: parentId, drawerOpen: false });
