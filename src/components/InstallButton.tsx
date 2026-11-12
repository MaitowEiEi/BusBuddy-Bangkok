import { Download, Share, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

const BTN =
  'inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-brand-50 px-3 text-sm font-semibold text-brand-700 ring-1 ring-slate-300 hover:bg-white';

/** Android/desktop: native install prompt. iPhone: short instructions (Safari has no prompt). */
export function InstallButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed) return null;

  if (deferred) {
    return (
      <button
        type="button"
        className={BTN}
        onClick={async () => {
          await deferred.prompt();
          await deferred.userChoice;
          setDeferred(null);
        }}
      >
        <Download aria-hidden className="h-4 w-4" />
        ติดตั้งแอป
      </button>
    );
  }

  if (!isIos()) return null;
  return (
    <div className="relative">
      <button type="button" className={BTN} aria-expanded={iosHint} onClick={() => setIosHint((v) => !v)}>
        <Download aria-hidden className="h-4 w-4" />
        ติดตั้งแอป
      </button>
      {iosHint && (
        <div role="dialog" aria-label="วิธีติดตั้งบน iPhone" className="absolute right-0 top-full z-[1300] mt-2 w-64 rounded-2xl bg-white p-3 text-sm shadow-xl ring-1 ring-slate-200">
          <p className="flex items-start gap-2">
            <Share aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
            <span>ใน Safari กดปุ่ม <strong>แชร์</strong> แล้วเลือก <strong>เพิ่มไปยังหน้าจอโฮม</strong></span>
          </p>
          <button type="button" onClick={() => setIosHint(false)} className="mt-2 inline-flex min-h-11 items-center gap-1 rounded-xl px-2 font-medium hover:bg-slate-100">
            <X aria-hidden className="h-4 w-4" />
            ปิด
          </button>
        </div>
      )}
    </div>
  );
}