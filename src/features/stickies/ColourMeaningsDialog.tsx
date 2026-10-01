import { useState } from 'react';
import { Dialog } from '@/design/Dialog';
import { Button } from '@/design/Button';
import { COLOUR_KEYS, COLOUR_LABELS } from '@/lib/palette';
import { saveColourMeanings, type ColourMeanings } from './colourMeanings';

export function ColourMeaningsDialog({ initial, onClose }: { initial: ColourMeanings; onClose: () => void }) {
  const [m, setM] = useState<ColourMeanings>(initial);
  return (
    <Dialog isOpen onOpenChange={(o) => !o && onClose()} title="Colour meanings">
      <form
        className="flex flex-col gap-3 p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          await saveColourMeanings(Object.fromEntries(Object.entries(m).filter(([, v]) => v?.trim())));
          onClose();
        }}
      >
        <p className="text-sm text-muted">Give colours a meaning, like “idea” or “urgent”. Meanings show on the filters so you can find things by what they are.</p>
        {COLOUR_KEYS.map((c) => (
          <label key={c} className="flex items-center gap-3 text-sm">
            <span className="h-6 w-6 shrink-0 rounded-[3px] border border-black/10" style={{ background: `var(--sticky-${c})` }} aria-hidden />
            <span className="w-16 shrink-0">{COLOUR_LABELS[c]}</span>
            <input
              value={m[c] ?? ''}
              placeholder="No meaning"
              maxLength={24}
              onChange={(e) => setM({ ...m, [c]: e.target.value })}
              aria-label={`Meaning of ${COLOUR_LABELS[c]}`}
              className="h-9 min-w-0 flex-1 rounded-panel border border-border bg-bg px-2 outline-none focus:border-accent"
            />
          </label>
        ))}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onPress={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
