import { create } from 'zustand';

export interface UndoEntry {
  label: string;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

interface UndoState {
  past: UndoEntry[];
  future: UndoEntry[];
}

const LIMIT = 100;

export const useUndo = create<UndoState>(() => ({ past: [], future: [] }));

/**
 * App-level undo for actions like move, trash and reorder. Editors (text, ink) keep their
 * own finer-grained history. Every reversible action should call `recordUndo` so the UI can
 * offer an Undo toast instead of an "Are you sure?" dialog.
 */
export function recordUndo(entry: UndoEntry) {
  useUndo.setState((s) => ({ past: [...s.past, entry].slice(-LIMIT), future: [] }));
}

export async function undo(): Promise<UndoEntry | undefined> {
  const entry = useUndo.getState().past.at(-1);
  if (!entry) return undefined;
  await entry.undo();
  useUndo.setState((s) => ({ past: s.past.slice(0, -1), future: [...s.future, entry] }));
  return entry;
}

export async function redo(): Promise<UndoEntry | undefined> {
  const entry = useUndo.getState().future.at(-1);
  if (!entry) return undefined;
  await entry.redo();
  useUndo.setState((s) => ({ future: s.future.slice(0, -1), past: [...s.past, entry] }));
  return entry;
}

export function clearUndo() {
  useUndo.setState({ past: [], future: [] });
}
