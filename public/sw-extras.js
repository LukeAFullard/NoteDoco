/*
 * Extra service-worker behaviour, imported into the worker that vite-plugin-pwa generates.
 */

/*
 * Taking over from v1 (decision 0007). v2 normally waits for you to accept an update, so it
 * never reloads mid-edit. v1 has no updater that would reload it, though, and a tab left on v1
 * would keep writing to v1's database. So the first time v2 installs where it isn't already in
 * charge (over v1, or on a first visit), it takes over straight away and reloads any open
 * page, which brings v1 tabs into v2. A marker cache records that v2 is in charge, so later
 * v2 updates wait and ask as usual.
 */
const V2_MARKER = 'notedoco-v2';
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.has(V2_MARKER).then((v2AlreadyHere) => {
      if (!v2AlreadyHere) return self.skipWaiting();
    }),
  );
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const takingOver = !(await caches.has(V2_MARKER));
      await caches.open(V2_MARKER);
      if (!takingOver) return;
      // Only pages this worker now controls: open v1 tabs. A first-ever v2 page isn't controlled.
      for (const page of await self.clients.matchAll({ type: 'window' })) page.navigate(page.url).catch(() => {});
    })(),
  );
});

/* Opens the item when a reminder notification is clicked. */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const hash = (event.notification.data && event.notification.data.hash) || '';
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const mine = windows.find((c) => c.url.startsWith(self.registration.scope));
      if (mine) {
        await mine.focus();
        mine.postMessage({ type: 'notedoco:open', hash });
        return;
      }
      await self.clients.openWindow(self.registration.scope + hash);
    })(),
  );
});
