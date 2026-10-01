import { create } from 'zustand';

/** Which sticky is open in the sticky editor dialog (it can be opened from any screen). */
export const useStickyDialog = create<{ id: string | null; fresh: boolean }>(() => ({ id: null, fresh: false }));

export const openSticky = (id: string, fresh = false) => useStickyDialog.setState({ id, fresh });
export const closeSticky = () => useStickyDialog.setState({ id: null, fresh: false });

/**
 * The open editor's close routine. Every way of closing (Done, Escape, clicking outside) goes
 * through it, so pending text is saved before deciding whether a new empty sticky is discarded.
 * Kept outside React state on purpose: re-registering it must not re-render anything.
 */
let requestClose: (() => Promise<void>) | null = null;
export const setRequestClose = (fn: (() => Promise<void>) | null) => {
  requestClose = fn;
};
export const getRequestClose = () => requestClose;
