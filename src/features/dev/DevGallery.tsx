import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Pane } from '@/app/Pane';
import { Button, IconButton } from '@/design/Button';
import { Switch } from '@/design/Switch';
import { Kbd } from '@/design/Kbd';
import { Dialog } from '@/design/Dialog';
import { Menu, MenuItem } from '@/design/Menu';
import { ColourSwatches } from '@/design/ColourSwatches';
import { EmptyState } from '@/design/EmptyState';
import { showToast } from '@/design/toast';
import { COLOUR_KEYS, COLOUR_LABELS, type ColourKey } from '@/lib/palette';

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-border px-4 py-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </section>
  );
}

/** A living reference of the design system. Check new primitives here in both themes. */
export function DevGallery() {
  const [colour, setColour] = useState<ColourKey>('lemon');
  const [dialog, setDialog] = useState(false);
  const [on, setOn] = useState(true);
  return (
    <Pane title="Design gallery">
      <Row title="Buttons">
        <Button variant="primary">Primary</Button>
        <Button>Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger"><Trash2 size={15} aria-hidden /> Delete</Button>
        <Button isDisabled>Disabled</Button>
        <Button size="sm" variant="primary"><Plus size={14} aria-hidden /> Small</Button>
        <IconButton label="Add"><Plus size={18} /></IconButton>
      </Row>
      <Row title="Stickies (content palette)">
        {COLOUR_KEYS.map((k) => (
          <div
            key={k}
            className="flex h-24 w-24 flex-col justify-between rounded-sm p-2 text-sm text-sticky-ink shadow-[0_2px_6px_rgba(0,0,0,0.25)]"
            style={{ background: `var(--sticky-${k})`, fontFamily: 'var(--font-sans)' }}
          >
            <span>Call Sam about the launch</span>
            <span className="font-mono text-[10px] opacity-70">{COLOUR_LABELS[k]}</span>
          </div>
        ))}
      </Row>
      <Row title="Colour picker">
        <ColourSwatches value={colour} onChange={setColour} />
        <span className="text-sm text-muted">{COLOUR_LABELS[colour]}</span>
      </Row>
      <Row title="Text">
        <div className="space-y-1">
          <p className="text-2xl font-semibold">Heading</p>
          <p className="text-sm">Body text on the surface.</p>
          <p className="text-sm text-muted">Muted text for secondary details.</p>
          <p className="font-mono text-sm tabular-nums">Fri 3 Oct · 14:30</p>
          <p className="text-sm"><span className="text-accent">Accent</span> · <span className="text-success">Success</span> · <span className="text-danger">Danger</span></p>
        </div>
      </Row>
      <Row title="Controls">
        <Switch isSelected={on} onChange={setOn}>Draw with finger</Switch>
        <Kbd>⌘K</Kbd>
        <Menu label="Example menu" trigger={<Button>Open menu</Button>}>
          <MenuItem onAction={() => showToast({ message: 'Picked one' }, 2000)}>First option</MenuItem>
          <MenuItem danger onAction={() => showToast({ message: 'Moved to Trash', action: { label: 'Undo', run: () => {} } })}>Delete</MenuItem>
        </Menu>
        <Button onPress={() => setDialog(true)}>Open dialog</Button>
        <Button onPress={() => showToast({ message: 'Moved to Trash', action: { label: 'Undo', run: () => {} } })}>Show toast</Button>
      </Row>
      <Row title="Empty state">
        <div className="w-full rounded-panel border border-dashed border-border">
          <EmptyState title="Nothing here yet" body="Say what this screen is for, then offer the one action that fills it." action={<Button variant="primary">Create the first one</Button>} />
        </div>
      </Row>
      <Dialog isOpen={dialog} onOpenChange={setDialog} title="Example dialog">
        <p className="px-5 py-3 text-sm text-muted">Centred on wide screens, a bottom sheet on phones.</p>
        <div className="flex justify-end p-5 pt-0">
          <Button variant="primary" onPress={() => setDialog(false)}>Done</Button>
        </div>
      </Dialog>
    </Pane>
  );
}
