import { Suspense, useEffect, useRef, useState } from 'react';
import { createMemoryRouter, Navigate, Outlet, RouterProvider, UNSAFE_LocationContext } from 'react-router';
import { PaneContext, type PaneControls } from '@/app/paneContext';
import { pageRoutes } from '@/app/routes';
import { closePane, setActivePane, setPanePath, type PaneRecord } from './store';

function PaneRoot() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted">Loading…</div>}>
      <Outlet />
    </Suspense>
  );
}

const paneRoutes = [{ path: '/', element: <PaneRoot />, children: [...pageRoutes, { path: '*', element: <Navigate to="/today" replace /> }] }];

/**
 * A pane beside the main view (WS-1). It has its own router, so links, back and forward work
 * inside it without touching the main view (WS-3).
 */
export function ExtraPane({ pane }: { pane: PaneRecord }) {
  // One router for the pane's lifetime (the pane is keyed by its id).
  const [router] = useState(() => createMemoryRouter(paneRoutes, { initialEntries: [pane.path] }));
  const [hist, setHist] = useState({ stack: [pane.path], index: 0 });
  const travelling = useRef(false);

  useEffect(
    () =>
      router.subscribe((state) => {
        const path = state.location.pathname + state.location.search;
        setPanePath(pane.id, path);
        if (travelling.current) {
          travelling.current = false;
          return;
        }
        setHist((h) => {
          if (h.stack[h.index] === path) return h;
          if (state.historyAction === 'REPLACE') return { stack: h.stack.map((p, i) => (i === h.index ? path : p)), index: h.index };
          const stack = [...h.stack.slice(0, h.index + 1), path];
          return { stack, index: stack.length - 1 };
        });
      }),
    [router, pane.id],
  );

  const go = (index: number) => {
    const path = hist.stack[index];
    if (path === undefined) return;
    travelling.current = true;
    setHist({ ...hist, index });
    void router.navigate(path, { replace: true });
  };

  const controls: PaneControls = {
    id: pane.id,
    back: () => go(hist.index - 1),
    forward: () => go(hist.index + 1),
    canBack: hist.index > 0,
    canForward: hist.index < hist.stack.length - 1,
    close: () => closePane(pane.id),
  };

  return (
    <div data-pane-id={pane.id} className="flex min-w-0 flex-1" onPointerDownCapture={() => setActivePane(pane.id)} onFocusCapture={() => setActivePane(pane.id)}>
      {/* A second router inside the main one: clear the outer location so React Router allows it. */}
      <UNSAFE_LocationContext.Provider value={null as never}>
        <PaneContext.Provider value={controls}>
          <RouterProvider router={router} />
        </PaneContext.Provider>
      </UNSAFE_LocationContext.Provider>
    </div>
  );
}
