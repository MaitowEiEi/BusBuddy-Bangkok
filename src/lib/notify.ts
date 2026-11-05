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

/** Reads a message aloud in Thai, if the device supports speech. */
export function speak(text: string): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'th-TH';
  const thai = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith('th'));
  if (thai) u.voice = thai;
  window.speechSynthesis.speak(u);
}

/** iOS only allows speech after a tap; call this inside a click handler. */
export function unlockSpeech(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(' ');
  u.volume = 0;
  window.speechSynthesis.speak(u);
}