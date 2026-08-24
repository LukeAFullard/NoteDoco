import React, { useState } from 'react';

interface ProjectFormModalProps {
  title: string;
  onClose: () => void;
  onSubmit: (name: string, color: 'signal' | 'verdigris' | 'rust' | 'graphite') => Promise<void>;
}

export function ProjectFormModal({ title, onClose, onSubmit }: ProjectFormModalProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState<'signal' | 'verdigris' | 'rust' | 'graphite'>('signal');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSubmit(name, color);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-stone dark:bg-graphite p-4 rounded-panel max-w-sm w-full">
        <h3 className="text-lg font-bold mb-2">{title}</h3>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project name"
            className="w-full p-2 mb-2 border rounded"
          />
          <select
            value={color}
            onChange={(e) => setColor(e.target.value as 'signal' | 'verdigris' | 'rust' | 'graphite')}
            className="w-full p-2 mb-2 border rounded"
          >
            <option value="signal">Signal</option>
            <option value="verdigris">Verdigris</option>
            <option value="rust">Rust</option>
            <option value="graphite">Graphite</option>
          </select>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-3 py-1">
              Cancel
            </button>
            <button type="submit" className="px-3 py-1 bg-signal text-ink rounded">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
