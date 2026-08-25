import { useState, type FormEvent } from 'react';
import { Modal } from '../ui/Modal';
import { Panel } from '../ui/Panel';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import type { Project } from '../../types';

const COLORS: Project['color'][] = ['signal', 'verdigris', 'rust', 'graphite'];

const COLOR_SWATCH_CLASS: Record<Project['color'], string> = {
  signal: 'bg-signal',
  verdigris: 'bg-verdigris',
  rust: 'bg-rust',
  graphite: 'bg-graphite dark:bg-stone',
};

interface ProjectFormModalProps {
  initialName?: string;
  initialColor?: Project['color'];
  title: string;
  onSubmit: (name: string, color: Project['color']) => void;
  onClose: () => void;
}

export function ProjectFormModal({ initialName = '', initialColor = 'signal', title, onSubmit, onClose }: ProjectFormModalProps) {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState<Project['color']>(initialColor);
  const isDirty = name !== initialName || color !== initialColor;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit(name.trim(), color);
  };

  return (
    <Modal onClose={onClose} isDirty={isDirty}>
      <Panel className="p-6 w-full max-w-sm">
        <form onSubmit={handleSubmit}>
          <h2 className="text-lg font-semibold text-graphite dark:text-stone mb-4">{title}</h2>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name" className="mb-4" />
          <div className="flex gap-2 mb-6">
            {COLORS.map((c) => (
              <button
                type="button"
                key={c}
                aria-label={`Color ${c}`}
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-full ${COLOR_SWATCH_CLASS[c]} ${
                  color === c ? 'ring-2 ring-offset-2 ring-graphite dark:ring-stone ring-offset-white dark:ring-offset-graphite' : ''
                }`}
              />
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary">Save</Button>
          </div>
        </form>
      </Panel>
    </Modal>
  );
}
