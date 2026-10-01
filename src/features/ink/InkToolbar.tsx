import { ClipboardPaste, Ellipsis, FilePlus2, Files, ImagePlus, NotebookText, Redo2, SquareDashedMousePointer, Star, Undo2 } from 'lucide-react';
import { Radio, RadioGroup } from 'react-aria-components';
import { IconButton } from '@/design/Button';
import { Menu, MenuItem } from '@/design/Menu';
import type { EngineState, EraserMode, InkTool } from '@/canvas/engine';
import type { PenTool } from '@/canvas/strokeStyle';
import { TOOLS } from './tools';
import { ColourPicker, EraserOptions, radioCls, Swatch, ThicknessPicker, triggerCls } from './pickers';
import { favouriteLabel, MAX_FAVOURITES, sameFavourite, type Favourite } from './favourites';

export interface ToolbarProps {
  state: EngineState;
  /** A sketch in a typed note: one page, so no page commands. */
  block?: boolean;
  favourites: Favourite[];
  onTool: (t: InkTool) => void;
  onColour: (c: string) => void;
  onSize: (s: number) => void;
  onEraser: (m: EraserMode, highlighterOnly: boolean) => void;
  onFavourite: (f: Favourite) => void;
  onAddFavourite: () => void;
  onRemoveFavourite: (i: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onAddPage: () => void;
  onPages: () => void;
  onPaper: () => void;
  onPaste: () => void;
  onSelectAll: () => void;
  onInsertImage: () => void;
}

const isPen = (t: InkTool): t is PenTool => t !== 'eraser' && t !== 'lasso' && t !== 'text';

/** The pen toolbar (INK-1–7). Every control has a name and works by keyboard. */
export function InkToolbar(p: ToolbarProps) {
  const { state } = p;
  const pen = isPen(state.tool);
  const current: Favourite | null = pen ? { tool: state.tool as PenTool, colour: state.colour, size: state.size } : null;
  return (
    <div role="toolbar" aria-label="Pens" className="flex flex-wrap items-center gap-x-1.5 gap-y-1 border-b border-border bg-surface px-2 py-1.5">
      <RadioGroup aria-label="Tool" orientation="horizontal" value={state.tool} onChange={(v) => p.onTool(v as InkTool)} className="flex gap-0.5">
        {TOOLS.map((t) => (
          <Radio key={t.tool} value={t.tool} aria-label={`${t.label} (${t.key})`} className={radioCls}>
            <span aria-hidden>{t.icon}</span>
          </Radio>
        ))}
      </RadioGroup>

      <span className="flex items-center gap-0.5">
        {state.tool === 'eraser' ? (
          <EraserOptions mode={state.eraser} highlighterOnly={state.eraseHighlighterOnly} onChange={p.onEraser} />
        ) : state.tool === 'lasso' ? null : state.tool === 'text' ? (
          <ColourPicker value={state.colour} onChange={p.onColour} kind="pen" />
        ) : (
          <>
            <ColourPicker value={state.colour} onChange={p.onColour} kind={state.tool === 'highlighter' ? 'highlighter' : 'pen'} isDisabled={!pen} />
            <ThicknessPicker value={state.size} onChange={p.onSize} isDisabled={!pen} />
          </>
        )}
      </span>

      <span className="h-6 w-px bg-border" aria-hidden />

      {/* Favourite pens (INK-5). */}
      <span role="group" aria-label="Favourite pens" className="flex items-center gap-0.5">
        {p.favourites.map((f, i) => {
          const tool = TOOLS.find((t) => t.tool === f.tool)!;
          const on = !!current && sameFavourite(f, current);
          return (
            <IconButton
              key={`${f.tool}-${f.colour}-${f.size}-${i}`}
              label={favouriteLabel(f)}
              aria-pressed={on}
              size="sm"
              onPress={() => p.onFavourite(f)}
              className={on ? 'relative h-9 w-9 bg-accent-soft' : 'relative h-9 w-9'}
            >
              {tool.icon}
              <Swatch colour={f.colour} className="absolute right-1 bottom-1 h-2.5 w-2.5" />
            </IconButton>
          );
        })}
        <Menu
          label="Favourite pens"
          trigger={
            <IconButton label="Favourite pens: add or remove" size="sm" className="h-9 w-9">
              <Star size={16} />
            </IconButton>
          }
        >
          <MenuItem textValue="Add this pen" onAction={p.onAddFavourite} isDisabled={!current || p.favourites.some((f) => sameFavourite(f, current))}>
            Add this pen{p.favourites.length >= MAX_FAVOURITES ? ' (replaces the first)' : ''}
          </MenuItem>
          {p.favourites.map((f, i) => (
            <MenuItem key={i} textValue={`Remove ${favouriteLabel(f)}`} onAction={() => p.onRemoveFavourite(i)}>
              Remove {favouriteLabel(f)}
            </MenuItem>
          ))}
        </Menu>
      </span>

      <span className="h-6 w-px bg-border" aria-hidden />

      <span className="flex gap-0.5">
        <IconButton label="Undo" size="sm" isDisabled={!state.canUndo} onPress={p.onUndo} className="h-9 w-9">
          <Undo2 size={18} />
        </IconButton>
        <IconButton label="Redo" size="sm" isDisabled={!state.canRedo} onPress={p.onRedo} className="h-9 w-9">
          <Redo2 size={18} />
        </IconButton>
        <Menu
          label="Pages and more"
          trigger={
            <IconButton label="Pages and more" size="sm" className={triggerCls}>
              <Ellipsis size={18} />
            </IconButton>
          }
        >
          {!p.block && (
            <MenuItem textValue="Add a page" onAction={p.onAddPage}>
              <FilePlus2 size={15} aria-hidden /> Add a page
            </MenuItem>
          )}
          {!p.block && (
            <MenuItem textValue="Pages" onAction={p.onPages}>
              <Files size={15} aria-hidden /> Pages…
            </MenuItem>
          )}
          <MenuItem textValue="Paper" onAction={p.onPaper}>
            <NotebookText size={15} aria-hidden /> Paper…
          </MenuItem>
          <MenuItem textValue="Insert image" onAction={p.onInsertImage}>
            <ImagePlus size={15} aria-hidden /> Insert image…
          </MenuItem>
          <MenuItem textValue="Select all on this page" onAction={p.onSelectAll}>
            <SquareDashedMousePointer size={15} aria-hidden /> Select all on this page
          </MenuItem>
          <MenuItem textValue="Paste" onAction={p.onPaste} isDisabled={!state.canPaste}>
            <ClipboardPaste size={15} aria-hidden /> Paste
          </MenuItem>
        </Menu>
      </span>
    </div>
  );
}
