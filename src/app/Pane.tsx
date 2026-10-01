import type { ReactNode } from 'react';
import { useLocation } from 'react-router';
import { ArrowLeft, ArrowRight, Columns2, X } from 'lucide-react';
import { IconButton } from '@/design/Button';
import { openPane } from '@/features/panes/store';
import { usePaneControls } from './paneContext';

/**
 * One pane of the workspace. Views render inside a Pane, never full-screen, so any view can
 * sit beside another (P2.11). In a side pane the header also has back, forward and close;
 * in the main view it has "Open beside".
 */
export function Pane({ title, actions, children }: { title: ReactNode; actions?: ReactNode; children: ReactNode }) {
  const pane = usePaneControls();
  const { pathname, search } = useLocation();
  return (
    <section className="flex h-full min-w-0 flex-1 flex-col" aria-label={typeof title === 'string' ? title : undefined}>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
        {pane && (
          <span className="-ml-2 flex shrink-0">
            <IconButton label="Back (in this pane)" size="sm" isDisabled={!pane.canBack} onPress={pane.back}>
              <ArrowLeft size={16} />
            </IconButton>
            <IconButton label="Forward (in this pane)" size="sm" isDisabled={!pane.canForward} onPress={pane.forward}>
              <ArrowRight size={16} />
            </IconButton>
          </span>
        )}
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{title}</h1>
        {actions}
        {pane ? (
          <IconButton label="Close this pane" size="sm" onPress={pane.close}>
            <X size={16} />
          </IconButton>
        ) : (
          <span className="hidden md:inline-flex">
            <IconButton label="Open this beside (split view)" size="sm" onPress={() => openPane(pathname + search)}>
              <Columns2 size={16} />
            </IconButton>
          </span>
        )}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </section>
  );
}
