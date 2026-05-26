'use client';

/**
 * Lightweight notification helper.
 *
 * Uses the Web Notifications API. Honest limitation: notifications fire
 * reliably only while the page is open or installed as a PWA; a fully-closed
 * website tab cannot push alerts the way a native app can. Always degrades
 * gracefully when permission is denied or the API is unavailable.
 */

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  if (!notificationsSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    const result = await Notification.requestPermission();
    return result === 'granted';
  } catch {
    return false;
  }
}

export function notify(title: string, body: string): void {
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  try {
    new Notification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: 'pulse-drop-alert',
    });
  } catch {
    /* some browsers require the SW registration to show notifications; ignore */
  }
}
