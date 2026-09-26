import type { ReactNode } from 'react';

/**
 * One pane of the workspace. v2.0 shows one pane; split view (P2.11) renders several side by
 * side, each with its own route and history. Views render inside a Pane, never full-screen.
 */
export function Pane({ title, actions, children }: { title: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex h-full min-w-0 flex-1 flex-col" aria-label={typeof title === 'string' ? title : undefined}>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{title}</h1>
        {actions}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </section>
  );
}
