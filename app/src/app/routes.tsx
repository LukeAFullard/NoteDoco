/* eslint-disable react/only-export-components -- a route table: lazy screens plus the list, never hot-reloaded on its own */
import { lazy } from 'react';
import { Navigate, type RouteObject } from 'react-router';

// Every screen is loaded on first use, to keep startup small (AGENTS.md rule 8).
const TodayPage = lazy(() => import('@/features/today/TodayPage').then((m) => ({ default: m.TodayPage })));
const TasksPage = lazy(() => import('@/features/tasks/TasksPage').then((m) => ({ default: m.TasksPage })));
const TimelinePage = lazy(() => import('@/features/timeline/TimelinePage').then((m) => ({ default: m.TimelinePage })));
const CalendarPage = lazy(() => import('@/features/calendar/CalendarPage').then((m) => ({ default: m.CalendarPage })));
const ColumnsPage = lazy(() => import('@/features/groups/ColumnsPage').then((m) => ({ default: m.ColumnsPage })));
const GroupPage = lazy(() => import('@/features/groups/GroupPage').then((m) => ({ default: m.GroupPage })));
const TrashPage = lazy(() => import('@/features/trash/TrashPage').then((m) => ({ default: m.TrashPage })));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const ItemPage = lazy(() => import('@/features/items/ItemPage').then((m) => ({ default: m.ItemPage })));
const InboxPage = lazy(() => import('@/features/inbox/InboxPage').then((m) => ({ default: m.InboxPage })));
const StickiesPage = lazy(() => import('@/features/stickies/StickiesPage').then((m) => ({ default: m.StickiesPage })));
const TagsPage = lazy(() => import('@/features/tags/TagsPage').then((m) => ({ default: m.TagsPage })));
const SearchPage = lazy(() => import('@/features/search/SearchPage').then((m) => ({ default: m.SearchPage })));
const DevGallery = lazy(() => import('@/features/dev/DevGallery').then((m) => ({ default: m.DevGallery })));
const InkLab = lazy(() => import('@/lab/ink/InkLab').then((m) => ({ default: m.InkLab })));

/**
 * The screens. The main window and every side-by-side pane (P2.11) route through the same
 * list, so anything can open in any pane.
 */
export const pageRoutes: RouteObject[] = [
  { index: true, element: <Navigate to="/today" replace /> },
  { path: 'today', element: <TodayPage /> },
  { path: 'inbox', element: <InboxPage /> },
  { path: 'tasks', element: <TasksPage /> },
  { path: 'timeline', element: <TimelinePage /> },
  { path: 'calendar', element: <CalendarPage /> },
  { path: 'stickies', element: <StickiesPage /> },
  { path: 'groups/:groupId', element: <GroupPage /> },
  { path: 'columns', element: <ColumnsPage /> },
  { path: 'items/:itemId', element: <ItemPage /> },
  { path: 'search', element: <SearchPage /> },
  { path: 'tags', element: <TagsPage /> },
  { path: 'tags/:tag', element: <TagsPage /> },
  { path: 'trash', element: <TrashPage /> },
  { path: 'settings', element: <SettingsPage /> },
  { path: 'dev', element: <DevGallery /> },
  { path: 'lab/ink', element: <InkLab /> },
];
