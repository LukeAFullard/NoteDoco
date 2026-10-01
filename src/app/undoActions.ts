import { redo, undo } from '@/data/undo';
import { showToast } from '@/design/toast';

export async function undoWithToast() {
  const entry = await undo();
  showToast({ message: entry ? `Undone: ${entry.label}` : 'Nothing to undo' }, 3000);
}

export async function redoWithToast() {
  const entry = await redo();
  showToast({ message: entry ? `Redone: ${entry.label}` : 'Nothing to redo' }, 3000);
}

/** Shows a toast for a reversible action, with an Undo button. */
export function toastWithUndo(message: string) {
  showToast({ message, action: { label: 'Undo', run: undoWithToast } });
}
