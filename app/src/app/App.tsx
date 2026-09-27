import { lazy, Suspense } from 'react';
import { createHashRouter, Navigate, RouterProvider } from 'react-router';
import { Shell } from './Shell';
import { NewFromShortcut } from '@/features/capture/NewFromShortcut';
import { pageRoutes } from './routes';

const UpdatePrompt = lazy(() => import('./UpdatePrompt').then((m) => ({ default: m.UpdatePrompt })));

// Hash routing works on GitHub Pages without server rewrites.
const routes = [
  {
    path: '/',
    element: <Shell />,
    children: [
      ...pageRoutes,
      // App-icon shortcuts (manifest) create an item in the Inbox and open it.
      { path: 'new/:kind', element: <NewFromShortcut /> },
      { path: '*', element: <Navigate to="/today" replace /> },
    ],
  },
];

const router = createHashRouter(routes);

// Preload the note editor once the app is idle, so pressing N and typing straight away never
// loses the first keystrokes while the editor downloads.
const preload = () => {
  void import('@/features/items/ItemPage');
  void import('@/features/notes/NoteEditor');
};
if (typeof window !== 'undefined') {
  if ('requestIdleCallback' in window) window.requestIdleCallback(preload, { timeout: 4000 });
  else setTimeout(preload, 2000);
}

export function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Suspense>
        <UpdatePrompt />
      </Suspense>
    </>
  );
}
