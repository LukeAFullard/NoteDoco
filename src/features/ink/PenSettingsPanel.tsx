import { Label, Radio, RadioGroup } from 'react-aria-components';
import { Button } from '@/design/Button';
import { Switch } from '@/design/Switch';
import { resetPenSettings, setPenSettings, usePenSettings, type PenSettings } from './penSettings';

const optionCls =
  'cursor-pointer rounded-panel border border-border px-3 py-1.5 text-sm outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-focus data-[selected]:border-accent data-[selected]:bg-accent-soft data-[selected]:font-medium';

function Choice<K extends keyof PenSettings>({ label, k, options }: { label: string; k: K; options: Array<[PenSettings[K], string]> }) {
  const value = usePenSettings((s) => s[k]);
  return (
    <RadioGroup
      value={String(value)}
      onChange={(v) => setPenSettings({ [k]: options.find(([o]) => String(o) === v)![0] } as Partial<PenSettings>)}
      orientation="horizontal"
      className="flex flex-col gap-1.5"
    >
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map(([v, text]) => (
          <Radio key={String(v)} value={String(v)} className={optionCls}>
            {text}
          </Radio>
        ))}
      </div>
    </RadioGroup>
  );
}

function Range({ label, hint, k, min, max, step, unit }: { label: string; hint: string; k: 'palmSize' | 'penGraceMs'; min: number; max: number; step: number; unit: string }) {
  const value = usePenSettings((s) => s[k]);
  const id = `pen-${k}`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="flex justify-between text-sm font-medium">
        {label}
        <span className="font-normal text-muted tabular-nums">
          {value} {unit}
        </span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => setPenSettings({ [k]: Number(e.target.value) })}
        className="h-6 w-full accent-[var(--color-accent-fill)]"
        aria-describedby={`${id}-hint`}
      />
      <span id={`${id}-hint`} className="text-xs text-muted">
        {hint}
      </span>
    </div>
  );
}

/** Pen and ink settings (P3.10, INK-23): in Settings, and from the ink editor's menu. */
export function PenSettingsPanel() {
  const snap = usePenSettings((s) => s.snapShapes);
  const prediction = usePenSettings((s) => s.prediction);
  return (
    <div className="flex flex-col gap-4">
      <Choice label="I write with my" k="hand" options={[['right', 'Right hand'], ['left', 'Left hand']]} />
      <Choice label="Pen toolbar" k="toolbar" options={[['top', 'Top'], ['side', 'Side (wider screens)'], ['bottom', 'Bottom']]} />
      <Choice label="Pen pressure" k="pressure" options={[['off', 'Off (even lines)'], ['light', 'Light touch'], ['normal', 'Normal'], ['firm', 'Firm']]} />
      <Choice
        label="Fingers"
        k="fingers"
        options={[
          ['auto', 'Draw until I use a pen'],
          ['always', 'Always draw'],
          ['never', 'Only move and zoom'],
        ]}
      />
      <Choice label="Pen button" k="barrel" options={[['eraser', 'Erases'], ['lasso', 'Lassoes']]} />
      <Switch isSelected={snap} onChange={(v) => setPenSettings({ snapShapes: v })}>
        Hold the pen still at the end of a stroke to make a clean shape
      </Switch>
      <Switch isSelected={prediction} onChange={(v) => setPenSettings({ prediction: v })}>
        Draw slightly ahead of the pen, so ink keeps up (where the browser supports it)
      </Switch>
      <details className="rounded-panel border border-border p-3">
        <summary className="cursor-pointer text-sm font-medium">Palm rejection</summary>
        <div className="mt-3 flex flex-col gap-4">
          <Range label="Ignore touches wider than" hint="A resting palm is bigger than a fingertip. Lower it if your palm still draws; raise it if fingers are ignored." k="palmSize" min={20} max={120} step={2} unit="px" />
          <Range label="Ignore touches after the pen lifts for" hint="Stops your hand drawing as you lift the pen." k="penGraceMs" min={0} max={1000} step={50} unit="ms" />
        </div>
      </details>
      <div>
        <Button variant="ghost" size="sm" onPress={resetPenSettings}>
          Reset pen settings
        </Button>
      </div>
    </div>
  );
}
