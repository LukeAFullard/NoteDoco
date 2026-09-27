/**
 * System notifications (ARCHITECTURE §12). They go through the service worker, because
 * `new Notification()` throws on Android Chrome; clicking one opens the item (see
 * public/sw-notifications.js).
 */

export type Permission = NotificationPermission | 'unsupported';

export const notificationPermission = (): Permission => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);

export async function askPermission(): Promise<Permission> {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.requestPermission();
}

export async function showSystemNotification(title: string, body: string, hash: string, tag: string): Promise<boolean> {
  if (notificationPermission() !== 'granted') return false;
  const reg = await navigator.serviceWorker?.getRegistration();
  if (!reg) return false;
  try {
    await reg.showNotification(title, { body, tag, data: { hash }, icon: 'pwa-192x192.svg', badge: 'pwa-192x192.svg' });
    return true;
  } catch {
    return false;
  }
}
