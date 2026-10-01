import { Check, FilePlus2, Redo2, Undo2 } from 'lucide-react';
import { Button as AriaButton, Dialog, DialogTrigger, Popover, Radio, RadioGroup } from 'react-aria-components';
import { IconButton } from '@/design/Button';
import { cn } from '@/design/cn';
import type { EngineState, InkTool } from '@/canvas/engine';
import { SIZES, TOOLS } from './tools';
import { HIGHLIGHTER_COLOUR_KEYS, INK_COLOURS, PEN_COLOUR_KEYS, inkLabel, resolveInk } from '@/canvas/inkColours';

const radioCls =
  'flex h-9 w-9 cursor-pointer items-center justify-center rounded-panel text-text outline-none transition-colors hover:bg-accent-soft data-[selected]:bg-accent-fill data-[selected]:text-on-accent data-[focus-visible]:ring-2 data-[focus-visible]:ring-focus';

export interface ToolbarProps {
  state: EngineState;
  onTool: (t: InkTool) => void;
  onColour: (c: string) => void;
  onSize: (s: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onAddPage: () => void;
}

/** The pen toolbar (INK-1, 2, 3, 5, 7). Every control has a name and works by keyboard. */
export function InkToolbar({ state, onTool, onColour, onSize, onUndo, onRedo, onAddPage }: ToolbarProps) {
  const highlighter = state.tool === 'highlighter';
  const keys = highlighter ? HIGHLIGHTER_COLOUR_KEYS : PEN_COLOUR_KEYS;
  return (
    <div role="toolbar" aria-label="Pens" className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-border bg-surface px-2 py-1.5">
      <RadioGroup aria-label="Tool" orientation="horizontal" value={state.tool} onChange={(v) => onTool(v as InkTool)} className="flex gap-0.5">
        {TOOLS.map((t) => (
          <Radio key={t.tool} value={t.tool} aria-label={`${t.label} (${t.key})`} className={radioCls}>
            <span aria-hidden>{t.icon}</span>
          </Radio>
        ))}
      </RadioGroup>

      <span className="h-6 w-px bg-border" aria-hidden />

      <DialogTrigger>
        <AriaButton
          aria-label={`Colour: ${inkLabel(state.colour)}`}
          isDisabled={state.tool === 'eraser'}
          className="flex h-9 w-9 items-center justify-center rounded-panel outline-none hover:bg-accent-soft data-[disabled]:opacity-40 data-[focus-visible]:ring-2 data-[focus-visible]:ring-focus"
        >
          <span className="block h-6 w-6 rounded-full border border-border" style={{ background: resolveInk(state.colour, 'white') }} aria-hidden />
        </AriaButton>
        <Popover placement="bottom" className="rounded-panel border border-border bg-surface p-2 shadow-lg outline-none">
          <Dialog aria-label={highlighter ? 'Highlighter colour' : 'Ink colour'} className="outline-none">
            {({ close }) => (
              <RadioGroup
                aria-label={highlighter ? 'Highlighter colour' : 'Ink colour'}
                orientation="horizontal"
                value={state.colour}
                onChange={(v) => {
                  onColour(v);
                  close();
                }}
                className="grid grid-cols-6 gap-1.5"
              >
                {keys.map((k) => (
                  <Radio
                    key={k}
                    value={k}
                    aria-label={INK_COLOURS[k].label}
                    className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-border outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-focus data-[focus-visible]:ring-offset-2"
                    style={{ background: INK_COLOURS[k].light }}
                  >
                    {({ isSelected }) =>
                      isSelected ? (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface text-text">
                          <Check size={14} aria-hidden />
                        </span>
                      ) : null
                    }
                  </Radio>
                ))}
              </RadioGroup>
            )}
          </Dialog>
        </Popover>
      </DialogTrigger>

      <RadioGroup
        aria-label="Thickness"
        orientation="horizontal"
        value={String(state.size)}
        onChange={(v) => onSize(Number(v))}
        isDisabled={state.tool === 'eraser'}
        className="flex gap-0.5 data-[disabled]:opacity-40"
      >
        {SIZES.map((s) => (
          <Radio key={s.size} value={String(s.size)} aria-label={s.label} className={radioCls}>
            <span aria-hidden className="block rounded-full bg-current" style={{ width: 3 + s.size * 5, height: 3 + s.size * 5 }} />
          </Radio>
        ))}
      </RadioGroup>

      <span className="h-6 w-px bg-border" aria-hidden />

      <span className="flex gap-0.5">
        <IconButton label="Undo" size="sm" isDisabled={!state.canUndo} onPress={onUndo} className="h-9 w-9">
          <Undo2 size={18} />
        </IconButton>
        <IconButton label="Redo" size="sm" isDisabled={!state.canRedo} onPress={onRedo} className="h-9 w-9">
          <Redo2 size={18} />
        </IconButton>
        <IconButton label="Add a page" size="sm" onPress={onAddPage} className={cn('h-9 w-9')}>
          <FilePlus2 size={18} />
        </IconButton>
      </span>
    </div>
  );
}
