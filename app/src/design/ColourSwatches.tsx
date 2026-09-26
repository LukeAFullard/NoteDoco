import { Check } from 'lucide-react';
import { Radio, RadioGroup } from 'react-aria-components';
import { COLOUR_KEYS, COLOUR_LABELS, type ColourKey } from '@/lib/palette';

/** Colour picker. Each swatch has a name (colour is never the only signal) and shows a tick when chosen. */
export function ColourSwatches({ value, onChange, label = 'Colour' }: { value: ColourKey; onChange: (c: ColourKey) => void; label?: string }) {
  return (
    <RadioGroup value={value} onChange={(v) => onChange(v as ColourKey)} aria-label={label} orientation="horizontal" className="flex flex-wrap gap-2">
      {COLOUR_KEYS.map((key) => (
        <Radio
          key={key}
          value={key}
          aria-label={COLOUR_LABELS[key]}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-black/10 text-sticky-ink outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-focus data-[focus-visible]:ring-offset-2"
          style={{ background: `var(--sticky-${key})` }}
        >
          {({ isSelected }) => (isSelected ? <Check size={16} aria-hidden /> : null)}
        </Radio>
      ))}
    </RadioGroup>
  );
}
