import { Copy, CopyPlus, Scissors, Trash2, X } from 'lucide-react';
import { IconButton } from '@/design/Button';
import type { EngineState } from '@/canvas/engine';
import { ColourPicker, ThicknessPicker } from './pickers';

export interface SelectionActions {
  onColour: (c: string) => void;
  onSize: (s: number) => void;
  onDuplicate: () => void;
  onCopy: () => void;
  onCut: () => void;
  onDelete: () => void;
  onDone: () => void;
}

/** Actions for lasso-selected ink (INK-6). Dragging, resizing and rotating happen on the canvas. */
export function SelectionBar({ selection, ...a }: { selection: NonNullable<EngineState['selection']> } & SelectionActions) {
  return (
    <div
      role="toolbar"
      aria-label="Selected ink"
      className="absolute bottom-14 left-1/2 z-10 flex max-w-[calc(100%-16px)] -translate-x-1/2 flex-wrap items-center justify-center gap-0.5 rounded-panel border border-border bg-surface p-1 text-sm shadow-lg"
    >
      <span className="px-2 text-muted">{selection.count} selected</span>
      <ColourPicker value={selection.colour} onChange={a.onColour} kind="any" />
      <ThicknessPicker value={selection.size} onChange={a.onSize} />
      <IconButton label="Duplicate (Ctrl+D)" size="sm" onPress={a.onDuplicate} className="h-9 w-9">
        <CopyPlus size={17} />
      </IconButton>
      <IconButton label="Copy (Ctrl+C)" size="sm" onPress={a.onCopy} className="h-9 w-9">
        <Copy size={17} />
      </IconButton>
      <IconButton label="Cut (Ctrl+X)" size="sm" onPress={a.onCut} className="h-9 w-9">
        <Scissors size={17} />
      </IconButton>
      <IconButton label="Delete (Delete)" size="sm" onPress={a.onDelete} className="h-9 w-9">
        <Trash2 size={17} />
      </IconButton>
      <IconButton label="Done (Esc)" size="sm" onPress={a.onDone} className="h-9 w-9">
        <X size={17} />
      </IconButton>
    </div>
  );
}
