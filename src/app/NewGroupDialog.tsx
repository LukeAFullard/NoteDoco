import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Form, Input, Label, TextField } from 'react-aria-components';
import { Dialog } from '@/design/Dialog';
import { Button } from '@/design/Button';
import { ColourSwatches } from '@/design/ColourSwatches';
import { createGroup } from '@/data/repos/groups';
import type { ColourKey } from '@/lib/palette';
import { useUi } from './ui';
import { maybeRequestPersistence } from './durability';

export function NewGroupDialog() {
  const { newGroupOpen, newGroupParent } = useUi();
  const [name, setName] = useState('');
  const [colour, setColour] = useState<ColourKey>('sky');
  const navigate = useNavigate();
  const close = () => {
    useUi.setState({ newGroupOpen: false });
    setName('');
  };

  return (
    <Dialog isOpen={newGroupOpen} onOpenChange={(o) => !o && close()} title={newGroupParent ? 'New sub-group' : 'New group'}>
      <Form
        className="flex flex-col gap-4 p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          const id = await createGroup({ name, colour, parentId: newGroupParent });
          close();
          navigate(`/groups/${id}`);
          void maybeRequestPersistence();
        }}
      >
        <TextField autoFocus value={name} onChange={setName} className="flex flex-col gap-1.5">
          <Label className="text-sm font-medium">Name</Label>
          <Input
            placeholder="e.g. Work, Home, Launch plan"
            className="h-10 rounded-panel border border-border bg-bg px-3 text-sm outline-none focus:border-accent"
          />
        </TextField>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Colour</span>
          <ColourSwatches value={colour} onChange={setColour} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onPress={close}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            Create group
          </Button>
        </div>
      </Form>
    </Dialog>
  );
}
