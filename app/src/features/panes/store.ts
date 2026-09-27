import { create } from 'zustand';
import { newId } from '@/lib/ids';
import { readPref, writePref } from '@/lib/localPref';

/** A pane beside the main view (WS-1), remembered across visits. */
export interface PaneRecord {
  id: string;
  path: string;
}

interface PanesState {
  panes: PaneRecord[];
  /** The pane last clicked or focused ('main' for the main view); paste and shortcuts go there. */
  active: string;
}

export const usePanes = create<PanesState>(() => ({ panes: readPref<PaneRecord[]>('panes', []), active: 'main' }));
const save = () => writePref('panes', usePanes.getState().panes);

/** Extra panes that fit: none on phones, one on tablets and laptops, up to three on wide screens. */
export function maxExtraPanes(width = typeof window === 'undefined' ? 1024 : window.innerWidth): number {
  if (width < 768) return 0;
  if (width < 1500) return 1;
  if (width < 1900) return 2;
  return 3;
}

/** Opens a path in a new pane (WS-3). When there's no room, the last pane shows it instead. */
export function openPane(path: string) {
  const max = maxExtraPanes();
  if (max === 0) {
    location.hash = `#${path}`;
    return;
  }
  const { panes } = usePanes.getState();
  const fresh = { id: newId(), path };
  usePanes.setState({ panes: panes.length >= max ? [...panes.slice(0, max - 1), fresh] : [...panes, fresh], active: fresh.id });
  save();
}

export function closePane(id: string) {
  usePanes.setState((s) => ({ panes: s.panes.filter((p) => p.id !== id), active: s.active === id ? 'main' : s.active }));
  save();
}

export function setPanePath(id: string, path: string) {
  usePanes.setState((s) => ({ panes: s.panes.map((p) => (p.id === id ? { ...p, path } : p)) }));
  save();
}

export const setActivePane = (id: string) => usePanes.getState().active !== id && usePanes.setState({ active: id });
