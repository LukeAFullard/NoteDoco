import { create } from 'zustand';

/** Multi-selection of items in the visible collection. */
interface SelectionState {
  ids: Set<string>;
  /** The last item clicked, for Shift-click range selection. */
  anchor: string | null;
}

export const useSelection = create<SelectionState>(() => ({ ids: new Set(), anchor: null }));

export function toggleSelected(id: string) {
  useSelection.setState((s) => {
    const ids = new Set(s.ids);
    if (ids.has(id)) ids.delete(id);
    else ids.add(id);
    return { ids, anchor: id };
  });
}

/** Shift-click: select everything between the anchor and `id` in the given order. */
export function selectRange(id: string, ordered: string[]) {
  useSelection.setState((s) => {
    const a = s.anchor ? ordered.indexOf(s.anchor) : -1;
    const b = ordered.indexOf(id);
    if (a < 0 || b < 0) return { ids: new Set([...s.ids, id]), anchor: id };
    const [from, to] = a < b ? [a, b] : [b, a];
    return { ids: new Set([...s.ids, ...ordered.slice(from, to + 1)]), anchor: s.anchor };
  });
}

export const clearSelection = () => useSelection.setState({ ids: new Set(), anchor: null });
export const selectAll = (ids: string[]) => useSelection.setState({ ids: new Set(ids), anchor: null });
