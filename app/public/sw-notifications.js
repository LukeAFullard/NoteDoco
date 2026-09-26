/* Opens the item when a reminder notification is clicked (imported into the service worker). */
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
