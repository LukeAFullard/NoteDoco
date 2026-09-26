import { FileText, LayoutDashboard, PenLine, StickyNote } from 'lucide-react';
import type { ItemKind } from '@/data/types';

export const KIND_ICONS: Record<ItemKind, typeof FileText> = {
  note: FileText,
  ink: PenLine,
  sticky: StickyNote,
  board: LayoutDashboard,
};

export const KIND_LABELS: Record<ItemKind, string> = { note: 'Note', ink: 'Ink note', sticky: 'Sticky', board: 'Board' };

export function itemTitle(title: string, kind: ItemKind): string {
  return title || (kind === 'sticky' ? 'Empty sticky' : 'Untitled');
}
