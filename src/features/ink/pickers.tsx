import type { ReactNode } from 'react';
import { Check, Settings2 } from 'lucide-react';
import { Button as AriaButton, Dialog, DialogTrigger, Popover, Radio, RadioGroup } from 'react-aria-components';
import { cn } from '@/design/cn';
import { Switch } from '@/design/Switch';
import type { EraserMode } from '@/canvas/engine';
import { HIGHLIGHTER_COLOUR_KEYS, INK_COLOURS, PEN_COLOUR_KEYS, inkLabel, resolveInk, type InkColourKey } from '@/canvas/inkColours';
import { SIZES, sizeLabel } from './tools';

export const triggerCls =
  'flex h-9 min-w-9 items-center justify-center gap-1 rounded-panel px-1.5 text-text outline-none hover:bg-accent-soft data-[disabled]:opacity-40 data-[focus-visible]:ring-2 data-[focus-visible]:ring-focus';

export const radioCls =
  'flex h-9 w-9 cursor-pointer items-center justify-center rounded-panel text-text outline-none transition-colors hover:bg-accent-soft data-[selected]:bg-accent-fill data-[selected]:text-on-accent data-[focus-visible]:ring-2 data-[focus-visible]:ring-focus';

const popoverCls = 'max-w-[calc(100vw-24px)] rounded-panel border border-border bg-surface p-3 text-text shadow-lg outline-none';

/** A toolbar button that opens a small panel. */
export function ToolPopover({ label, trigger, children, isDisabled }: { label: string; trigger: ReactNode; children: (close: () => void) => ReactNode; isDisabled?: boolean }) {
  return (
    <DialogTrigger>
      <AriaButton aria-label={label} isDisabled={isDisabled} className={triggerCls}>
        {trigger}
      </AriaButton>
      <Popover placement="bottom" className={popoverCls}>
        <Dialog aria-label={label} className="outline-none">
          {({ close }) => children(close)}
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}

/** A colour swatch as it looks on white paper (custom colours as they are). */
export function Swatch({ colour, className }: { colour: string; className?: string }) {
  return <span aria-hidden className={cn('block rounded-full border border-border', className)} style={{ background: resolveInk(colour, 'white') }} />;
}

/** Ink colours: the pen or highlighter palette, plus any custom colour (INK-5). */
export function ColourPicker({
  value,
  onChange,
  kind,
  isDisabled,
}: {
  value: string | null;
  onChange: (c: string) => void;
  kind: 'pen' | 'highlighter' | 'any';
  isDisabled?: boolean;
}) {
  const keys: readonly InkColourKey[] = kind === 'pen' ? PEN_COLOUR_KEYS : kind === 'highlighter' ? HIGHLIGHTER_COLOUR_KEYS : [...PEN_COLOUR_KEYS, ...HIGHLIGHTER_COLOUR_KEYS];
  const title = kind === 'highlighter' ? 'Highlighter colour' : 'Ink colour';
  return (
    <ToolPopover label={`${title}: ${value ? inkLabel(value) : 'mixed'}`} isDisabled={isDisabled} trigger={<Swatch colour={value ?? 'black'} className="h-6 w-6" />}>
      {(close) => (
        <div className="flex flex-col gap-3">
          <RadioGroup
            aria-label={title}
            orientation="horizontal"
            value={value}
            onChange={(v) => {
              onChange(v);
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
          <label className="flex items-center gap-2 text-sm">
            <input
              type="color"
              value={value ? resolveInk(value, 'white') : '#000000'}
              onChange={(e) => onChange(e.target.value)}
              className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent"
            />
            Custom colour
          </label>
        </div>
      )}
    </ToolPopover>
  );
}

export function ThicknessPicker({ value, onChange, isDisabled }: { value: number | null; onChange: (s: number) => void; isDisabled?: boolean }) {
  return (
    <ToolPopover label={`Thickness: ${value ? sizeLabel(value).toLowerCase() : 'mixed'}`} isDisabled={isDisabled} trigger={<SizeDot size={value ?? 1} />}>
      {(close) => (
        <RadioGroup
          aria-label="Thickness"
          orientation="horizontal"
          value={value === null ? null : String(value)}
          onChange={(v) => {
            onChange(Number(v));
            close();
          }}
          className="flex gap-1"
        >
          {SIZES.map((s) => (
            <Radio key={s.size} value={String(s.size)} aria-label={s.label} className={radioCls}>
              <SizeDot size={s.size} />
            </Radio>
          ))}
        </RadioGroup>
      )}
    </ToolPopover>
  );
}

/** Whole-stroke or precise erasing, and "highlighter only" (INK-3). */
export function EraserOptions({ mode, highlighterOnly, onChange }: { mode: EraserMode; highlighterOnly: boolean; onChange: (m: EraserMode, highlighterOnly: boolean) => void }) {
  return (
    <ToolPopover label="Eraser options" trigger={<Settings2 size={18} aria-hidden />}>
      {() => (
        <div className="flex w-60 flex-col gap-3">
          <RadioGroup aria-label="Eraser" value={mode} onChange={(v) => onChange(v as EraserMode, highlighterOnly)} className="flex flex-col gap-1 text-sm">
            {(
              [
                ['stroke', 'Whole strokes'],
                ['precise', 'Only what it touches'],
              ] as const
            ).map(([v, label]) => (
              <Radio key={v} value={v} className="group flex cursor-pointer items-center gap-2 rounded px-1 py-1.5 outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-focus">
                <span className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-muted group-data-[selected]:border-accent">
                  <span className="hidden h-2 w-2 rounded-full bg-accent group-data-[selected]:block" />
                </span>
                {label}
              </Radio>
            ))}
          </RadioGroup>
          <Switch isSelected={highlighterOnly} onChange={(on) => onChange(mode, on)}>
            Erase highlighter only
          </Switch>
        </div>
      )}
    </ToolPopover>
  );
}

/** A dot that shows a thickness. */
export function SizeDot({ size }: { size: number }) {
  const d = Math.min(18, 3 + size * 5);
  return <span aria-hidden className="block rounded-full bg-current" style={{ width: d, height: d }} />;
}
