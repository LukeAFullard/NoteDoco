import { X } from 'lucide-react';
import { dismissToast, useToasts } from './toast';
import { cn } from './cn';

/** Renders toasts in a polite live region so screen readers announce them. */
export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cn(
            'pointer-events-auto flex max-w-md items-center gap-3 rounded-panel border border-border bg-surface px-4 py-2.5 text-sm shadow-lg',
            t.tone === 'danger' && 'border-danger/40',
          )}
        >
          <span className="flex-1">{t.message}</span>
          {t.action && (
            <button
              type="button"
              className="font-semibold text-accent hover:underline"
              onClick={async () => {
                dismissToast(t.id);
                await t.action!.run();
              }}
            >
              {t.action.label}
            </button>
          )}
          <button type="button" aria-label="Dismiss" className="text-muted hover:text-text" onClick={() => dismissToast(t.id)}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
