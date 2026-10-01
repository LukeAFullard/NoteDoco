import { Switch as AriaSwitch, type SwitchProps } from 'react-aria-components';
import type { ReactNode } from 'react';

export function Switch({ children, ...props }: Omit<SwitchProps, 'children'> & { children: ReactNode }) {
  return (
    <AriaSwitch {...props} className="group flex items-center gap-3 text-sm cursor-pointer">
      <span className="flex h-6 w-10 shrink-0 items-center rounded-full bg-surface-2 p-0.5 transition-colors group-data-[selected]:bg-accent-fill group-data-[focus-visible]:ring-2 group-data-[focus-visible]:ring-focus">
        <span className="h-5 w-5 rounded-full bg-surface shadow transition-transform group-data-[selected]:translate-x-4" />
      </span>
      {children}
    </AriaSwitch>
  );
}
