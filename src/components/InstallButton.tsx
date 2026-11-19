import { Download, Share, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useT } from '../lib/i18n';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

/** Icon-only so the header fits on narrow phones; the label is for screen readers and the tooltip. */
const BTN =
  'grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-slate-300 hover:bg-white';

/** Android/desktop: native install prompt. iPhone: short instructions (Safari has no prompt). */
export function InstallButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);
  const [iosHint, setIosHint] = useState(false);
  const tr = useT();
  const label = tr('ติดตั้งแอป', 'Install app');

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
        aria-label={label}
        title={label}
        onClick={async () => {
          await deferred.prompt();
          await deferred.userChoice;
          setDeferred(null);
        }}
      >
        <Download aria-hidden className="h-5 w-5" />
      </button>
    );
  }

  if (!isIos()) return null;
  return (
    <div className="relative">
      <button type="button" className={BTN} aria-label={label} title={label} aria-expanded={iosHint} onClick={() => setIosHint((v) => !v)}>
        <Download aria-hidden className="h-5 w-5" />
      </button>
      {iosHint && (
        <div role="dialog" aria-label={tr('วิธีติดตั้งบน iPhone', 'How to install on iPhone')} className="absolute right-0 top-full z-[1300] mt-2 w-64 rounded-2xl bg-white p-3 text-sm shadow-xl ring-1 ring-slate-200">
          <p className="flex items-start gap-2">
            <Share aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
            <span>
              {tr('ใน Safari กดปุ่ม', 'In Safari, tap')} <strong>{tr('แชร์', 'Share')}</strong>{' '}
              {tr('แล้วเลือก', 'then')} <strong>{tr('เพิ่มไปยังหน้าจอโฮม', 'Add to Home Screen')}</strong>
            </span>
          </p>
          <button type="button" onClick={() => setIosHint(false)} className="mt-2 inline-flex min-h-11 items-center gap-1 rounded-xl px-2 font-medium hover:bg-slate-100">
            <X aria-hidden className="h-4 w-4" />
            {tr('ปิด', 'Close')}
          </button>
        </div>
      )}
    </div>
  );
}