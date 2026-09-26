import { lazy, Suspense } from 'react';
import { createHashRouter, Navigate, RouterProvider } from 'react-router';
import { Shell } from './Shell';
import { TodayPage } from '@/features/today/TodayPage';
import { InboxPage } from '@/features/inbox/InboxPage';

const GroupPage = lazy(() => import('@/features/groups/GroupPage').then((m) => ({ default: m.GroupPage })));
const TrashPage = lazy(() => import('@/features/trash/TrashPage').then((m) => ({ default: m.TrashPage })));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const DevGallery = lazy(() => import('@/features/dev/DevGallery').then((m) => ({ default: m.DevGallery })));
const UpdatePrompt = lazy(() => import('./UpdatePrompt').then((m) => ({ default: m.UpdatePrompt })));
const InkLab = lazy(() => import('@/lab/ink/InkLab').then((m) => ({ default: m.InkLab })));

// Hash routing works on GitHub Pages without server rewrites.
const routes = [
  {
    path: '/',
    element: <Shell />,
    children: [
      { index: true, element: <Navigate to="/today" replace /> },
      { path: 'today', element: <TodayPage /> },
      { path: 'inbox', element: <InboxPage /> },
      { path: 'groups/:groupId', element: <GroupPage /> },
      { path: 'trash', element: <TrashPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'dev', element: <DevGallery /> },
      { path: 'lab/ink', element: <InkLab /> },
      // App-icon shortcuts point here; notes and stickies arrive in Phase 1.
      { path: 'new/:kind', element: <Navigate to="/inbox" replace /> },
      { path: '*', element: <Navigate to="/today" replace /> },
    ],
  },
];

const router = createHashRouter(routes);

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
