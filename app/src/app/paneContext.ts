import { createContext, useCallback, useContext } from 'react';
import { usePanes } from '@/features/panes/store';

/** Controls for a side-by-side pane (WS-1, WS-3); null in the main view. */
export interface PaneControls {
  id: string;
  back: () => void;
  forward: () => void;
  canBack: boolean;
  canForward: boolean;
  close: () => void;
}

export const PaneContext = createContext<PaneControls | null>(null);

export const usePaneControls = () => useContext(PaneContext);
export const usePaneId = () => useContext(PaneContext)?.id ?? 'main';

/**
 * Document-wide listeners (paste, find, Escape) should only act in the pane you're using.
 * Returns a check to call when the event happens.
 */
export function useIsActivePane() {
  const id = usePaneId();
  return useCallback(() => usePanes.getState().active === id, [id]);
}

/** Whether an event target is inside this pane. */
export function useInPane() {
  const id = usePaneId();
  return useCallback((target: EventTarget | null) => target instanceof Node && !!document.querySelector(`[data-pane-id="${id}"]`)?.contains(target), [id]);
}
