/**
 * Native drag and drop payloads (no library, so nothing is added to startup). Every drag has a
 * keyboard alternative in a menu ("Move to…", "Move group…").
 */
export const DRAG_ITEMS = 'application/x-notedoco-items';
export const DRAG_GROUP = 'application/x-notedoco-group';

export function setDragItems(e: DragEvent | React.DragEvent, ids: string[]) {
  e.dataTransfer!.setData(DRAG_ITEMS, JSON.stringify(ids));
  e.dataTransfer!.setData('text/plain', `${ids.length} item${ids.length === 1 ? '' : 's'}`);
  e.dataTransfer!.effectAllowed = 'move';
}

export function setDragGroup(e: DragEvent | React.DragEvent, id: string) {
  e.dataTransfer!.setData(DRAG_GROUP, id);
  e.dataTransfer!.effectAllowed = 'move';
}

/** What's being dragged (types are readable during dragover; data only on drop). */
export function dragKind(e: DragEvent | React.DragEvent): 'items' | 'group' | null {
  const types = e.dataTransfer?.types ?? [];
  if (types.includes(DRAG_ITEMS)) return 'items';
  if (types.includes(DRAG_GROUP)) return 'group';
  return null;
}

export function readDragItems(e: DragEvent | React.DragEvent): string[] {
  try {
    return JSON.parse(e.dataTransfer?.getData(DRAG_ITEMS) || '[]') as string[];
  } catch {
    return [];
  }
}

/** Where on a row the pointer is: top quarter = before, bottom quarter = after, else inside. */
export function dropZone(e: React.DragEvent, el: HTMLElement): 'before' | 'inside' | 'after' {
  const r = el.getBoundingClientRect();
  const y = (e.clientY - r.top) / r.height;
  return y < 0.25 ? 'before' : y > 0.75 ? 'after' : 'inside';
}

/** Drag only with a mouse or trackpad; on touch, long-press is for selecting. */
export const canDrag = () => typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches;
