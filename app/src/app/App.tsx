import { lazy, Suspense } from 'react';
import { createHashRouter, Navigate, RouterProvider } from 'react-router';
import { Shell } from './Shell';
import { NewFromShortcut } from '@/features/capture/NewFromShortcut';

const TodayPage = lazy(() => import('@/features/today/TodayPage').then((m) => ({ default: m.TodayPage })));
const TasksPage = lazy(() => import('@/features/tasks/TasksPage').then((m) => ({ default: m.TasksPage })));
const TimelinePage = lazy(() => import('@/features/timeline/TimelinePage').then((m) => ({ default: m.TimelinePage })));
const GroupPage = lazy(() => import('@/features/groups/GroupPage').then((m) => ({ default: m.GroupPage })));
const TrashPage = lazy(() => import('@/features/trash/TrashPage').then((m) => ({ default: m.TrashPage })));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const ItemPage = lazy(() => import('@/features/items/ItemPage').then((m) => ({ default: m.ItemPage })));
const InboxPage = lazy(() => import('@/features/inbox/InboxPage').then((m) => ({ default: m.InboxPage })));
const StickiesPage = lazy(() => import('@/features/stickies/StickiesPage').then((m) => ({ default: m.StickiesPage })));
const TagsPage = lazy(() => import('@/features/tags/TagsPage').then((m) => ({ default: m.TagsPage })));
const SearchPage = lazy(() => import('@/features/search/SearchPage').then((m) => ({ default: m.SearchPage })));
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
      { path: 'tasks', element: <TasksPage /> },
      { path: 'timeline', element: <TimelinePage /> },
      { path: 'stickies', element: <StickiesPage /> },
      { path: 'groups/:groupId', element: <GroupPage /> },
      { path: 'items/:itemId', element: <ItemPage /> },
      { path: 'search', element: <SearchPage /> },
      { path: 'tags', element: <TagsPage /> },
      { path: 'tags/:tag', element: <TagsPage /> },
      { path: 'trash', element: <TrashPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'dev', element: <DevGallery /> },
      { path: 'lab/ink', element: <InkLab /> },
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
