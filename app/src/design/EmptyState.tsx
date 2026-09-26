import type { ReactNode } from 'react';

/** Every empty screen says what it's for and offers the one action that fills it. */
export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-3 px-6 py-16 text-center">
      {icon && <div className="text-muted">{icon}</div>}
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-muted">{body}</p>
      {action}
    </div>
  );
}
