import { Bus, FlaskConical } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { DemoControls } from './DemoControls';
import { SearchBox } from './SearchBox';

export function AppHeader() {
  const { goHome } = useApp();
  return (
    <header className="relative z-[1200] shrink-0 space-y-2 border-b border-slate-200 bg-white px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] lg:px-4 lg:pb-3">
      <div className="flex items-center gap-2">
        <button type="button" onClick={goHome} className="flex min-h-11 items-center gap-2 rounded-xl pr-2" aria-label="BusBuddy Bangkok กลับหน้าหลัก">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-700 text-white">
            <Bus aria-hidden className="h-5 w-5" />
          </span>
          <span className="text-base font-bold">
            BusBuddy <span className="font-medium text-brand-700">Bangkok</span>
          </span>
        </button>
        <div className="ml-auto">
          <DemoControls />
        </div>
      </div>
      <SearchBox />
      <p className="flex items-center gap-1.5 text-xs text-ink-muted">
        <FlaskConical aria-hidden className="h-3.5 w-3.5 shrink-0" />
        โหมดต้นแบบ — ข้อมูลรถ เวลา และรางวัลเป็นข้อมูลจำลอง
      </p>
    </header>
  );
}