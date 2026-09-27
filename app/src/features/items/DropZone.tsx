import { useState, type ReactNode } from 'react';
import { cn } from '@/design/cn';
import { dragKind, readDragItems } from '@/lib/dnd';

/**
 * Accepts items dragged from any list, card or pane (WS-2): into a group, onto a day, into a
 * lane. Dragging is a mouse shortcut; every drop has a menu alternative ("Move to…", "Date…").
 */
export function ItemDropZone({
  onDropItems,
  className,
  children,
  ...rest
}: {
  onDropItems: (ids: string[]) => void | Promise<void>;
  className?: string;
  children: ReactNode;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'onDrop' | 'onDragOver' | 'onDragLeave' | 'children' | 'className'>) {
  const [over, setOver] = useState(false);
  return (
    <div
      {...rest}
      onDragOver={(e) => {
        if (dragKind(e) !== 'items') return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
      }}
      onDrop={(e) => {
        if (dragKind(e) !== 'items') return;
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
        const ids = readDragItems(e);
        if (ids.length) void onDropItems(ids);
      }}
      className={cn(className, over && 'bg-accent-soft/50 ring-2 ring-inset ring-focus')}
    >
      {children}
    </div>
  );
}
