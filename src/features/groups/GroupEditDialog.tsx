import { useState } from 'react';
import { Form, Input, Label, TextField } from 'react-aria-components';
import { Dialog } from '@/design/Dialog';
import { Button } from '@/design/Button';
import { ColourSwatches } from '@/design/ColourSwatches';
import { updateGroup } from '@/data/repos/groups';
import type { Group } from '@/data/types';

const EMOJI = ['📁', '💼', '🏠', '🚀', '📚', '🎨', '🛒', '✈️', '💡', '🧪', '❤️', '🌱', '🎓', '🗓️', '🔧', '⭐'];

export function GroupEditDialog({ group, isOpen, onClose }: { group: Group; isOpen: boolean; onClose: () => void }) {
  const [name, setName] = useState(group.name);
  const [icon, setIcon] = useState<string | null>(group.icon);
  const [colour, setColour] = useState(group.colour);
  return (
    <Dialog isOpen={isOpen} onOpenChange={(o) => !o && onClose()} title="Edit group">
      <Form
        className="flex flex-col gap-4 p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          await updateGroup(group.id, { name: name.trim() || group.name, icon, colour });
          onClose();
        }}
      >
        <TextField autoFocus value={name} onChange={setName} className="flex flex-col gap-1.5">
          <Label className="text-sm font-medium">Name</Label>
          <Input className="h-10 rounded-panel border border-border bg-bg px-3 text-sm outline-none focus:border-accent" />
        </TextField>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Icon</span>
          <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Icon">
            <button
              type="button"
              role="radio"
              aria-checked={icon === null}
              onClick={() => setIcon(null)}
              className={`h-9 rounded-panel px-2 text-xs ${icon === null ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-2'}`}
            >
              None
            </button>
            {EMOJI.map((e) => (
              <button
                key={e}
                type="button"
                role="radio"
                aria-checked={icon === e}
                aria-label={e}
                onClick={() => setIcon(e)}
                className={`h-9 w-9 rounded-panel text-lg ${icon === e ? 'bg-accent-soft ring-1 ring-accent' : 'hover:bg-surface-2'}`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Colour</span>
          <ColourSwatches value={colour} onChange={setColour} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onPress={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            Save
          </Button>
        </div>
      </Form>
    </Dialog>
  );
}
