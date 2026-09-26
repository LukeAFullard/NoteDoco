import type { ReactNode } from 'react';
import { Menu as AriaMenu, MenuItem as AriaMenuItem, MenuTrigger, Popover, type MenuItemProps } from 'react-aria-components';
import { cn } from './cn';

export function Menu({ trigger, children, label, defaultOpen }: { trigger: ReactNode; children: ReactNode; label: string; defaultOpen?: boolean }) {
  return (
    <MenuTrigger defaultOpen={defaultOpen}>
      {trigger}
      <Popover className="min-w-48 rounded-panel border border-border bg-surface p-1 shadow-lg outline-none">
        <AriaMenu aria-label={label} className="outline-none">
          {children}
        </AriaMenu>
      </Popover>
    </MenuTrigger>
  );
}

export function MenuItem({ className, danger, ...props }: MenuItemProps & { danger?: boolean; className?: string }) {
  return (
    <AriaMenuItem
      {...props}
      className={cn(
        'flex cursor-default items-center gap-2 rounded px-2.5 py-1.5 text-sm outline-none',
        'data-[focused]:bg-accent-soft',
        danger ? 'text-danger' : 'text-text',
        className,
      )}
    />
  );
}
