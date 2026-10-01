/*
 * Retires the service worker of the old v2 preview at /next/. When a preview tab checks for an
 * update it gets this file: it takes over at once, unregisters itself, clears the preview's
 * caches and sends open tabs to the main address, where v2 now lives. Notes are unaffected:
 * they're stored per site, not per folder.
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await self.registration.unregister();
      // Only the preview's own caches (their names include its /next/ scope), never the main app's.
      for (const key of await caches.keys()) if (key.includes(self.registration.scope)) await caches.delete(key);
      const windows = await self.clients.matchAll({ type: 'window' });
      for (const client of windows) client.navigate(client.url.replace(/\/next\/[^#]*/, '/'));
    })(),
  );
});
