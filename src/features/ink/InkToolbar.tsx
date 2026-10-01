import { ClipboardPaste, Ellipsis, Settings2, FileDown, FilePlus2, Files, ImageDown, ImagePlus, NotebookText, Printer, Redo2, SquareDashedMousePointer, Star, Undo2 } from 'lucide-react';
import { Separator } from 'react-aria-components';
import { cn } from '@/design/cn';
import type { InkExport } from './exportInk';
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
  /** Toolbar down the side (on wider screens) or along the bottom (INK-23). */
  side?: boolean;
  bottom?: boolean;
  onPenSettings: () => void;
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
  onExport: (kind: InkExport) => void;
}

const isPen = (t: InkTool): t is PenTool => t !== 'eraser' && t !== 'lasso' && t !== 'text';

/** The pen toolbar (INK-1–7). Every control has a name and works by keyboard. */
export function InkToolbar(p: ToolbarProps) {
  const { state } = p;
  const pen = isPen(state.tool);
  const current: Favourite | null = pen ? { tool: state.tool as PenTool, colour: state.colour, size: state.size } : null;
  // Down the side on wider screens: groups stack, separators turn horizontal.
  const v = (cls: string) => (p.side ? cls : '');
  const group = cn('flex items-center gap-0.5', v('sm:flex-col'));
  const sep = cn('h-6 w-px bg-border', v('sm:h-px sm:w-6'));
  return (
    <div
      role="toolbar"
      aria-label="Pens"
      className={cn(
        'flex shrink-0 flex-wrap items-center gap-x-1.5 gap-y-1 bg-surface px-2 py-1.5',
        p.bottom ? 'border-t border-border' : 'border-b border-border',
        v('sm:flex-col sm:flex-nowrap sm:overflow-y-auto sm:border-b-0 sm:border-x sm:px-1 sm:py-2'),
      )}
    >
      <RadioGroup aria-label="Tool" orientation="horizontal" value={state.tool} onChange={(v) => p.onTool(v as InkTool)} className={group}>
        {TOOLS.map((t) => (
          <Radio key={t.tool} value={t.tool} aria-label={`${t.label} (${t.key})`} className={radioCls}>
            <span aria-hidden>{t.icon}</span>
          </Radio>
        ))}
      </RadioGroup>

      <span className={group}>
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

      <span className={sep} aria-hidden />

      {/* Favourite pens (INK-5). */}
      <span role="group" aria-label="Favourite pens" className={group}>
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

      <span className={sep} aria-hidden />

      <span className={group}>
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
          <MenuItem textValue="Pen settings" onAction={p.onPenSettings}>
            <Settings2 size={15} aria-hidden /> Pen settings…
          </MenuItem>
          <Separator className="my-1 h-px bg-border" />
          <MenuItem textValue="Export as PDF" onAction={() => p.onExport('pdf')}>
            <FileDown size={15} aria-hidden /> Export as PDF
          </MenuItem>
          <MenuItem textValue="Export as SVG" onAction={() => p.onExport('svg')}>
            <FileDown size={15} aria-hidden /> Export as SVG
          </MenuItem>
          <MenuItem textValue="Export this page as PNG" onAction={() => p.onExport('png')}>
            <ImageDown size={15} aria-hidden /> Export {p.block ? 'as' : 'this page as'} PNG
          </MenuItem>
          <MenuItem textValue="Print" onAction={() => p.onExport('print')}>
            <Printer size={15} aria-hidden /> Print…
          </MenuItem>
        </Menu>
      </span>
    </div>
  );
}
