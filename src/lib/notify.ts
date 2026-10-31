export type NotifyPermission = 'granted' | 'denied' | 'default' | 'unsupported';

export function notifyPermission(): NotifyPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

/** Must be called from a click handler, otherwise browsers ignore the request. */
export async function requestNotifyPermission(): Promise<NotifyPermission> {
  const current = notifyPermission();
  if (current !== 'default') return current;
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

/** Returns false when a system notification could not be shown (the caller shows an in-app toast instead). */
export function showSystemNotification(title: string, body: string, tag: string): boolean {
  if (notifyPermission() !== 'granted') return false;
  try {
    new Notification(title, { body, tag });
    return true;
  } catch {
    // Android Chrome only allows notifications from a service worker.
    return false;
  }
}