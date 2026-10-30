import { useApp } from '../state/AppContext';
import type { ServiceNotice } from '../types/transit';
import { Banner, type BannerTone } from './ui/Banner';

const SEVERITY: Record<ServiceNotice['severity'], { tone: BannerTone; label: string }> = {
  info: { tone: 'info', label: 'ประกาศ' },
  warning: { tone: 'warning', label: 'คำเตือน' },
  disruption: { tone: 'disruption', label: 'เหตุขัดข้อง' },
};

export function NoticeList({ routeIds, includeInfo = true }: { routeIds?: string[]; includeInfo?: boolean }) {
  const { snapshot } = useApp();
  const notices = (snapshot?.notices ?? []).filter(
    (n) => (includeInfo || n.severity !== 'info') && (!routeIds || n.routeIds.some((id) => routeIds.includes(id))),
  );
  if (notices.length === 0) return null;
  return (
    <ul aria-label="ประกาศการเดินรถ" className="space-y-2 px-4">
      {notices.map((n) => (
        <li key={n.id}>
          <Banner tone={SEVERITY[n.severity].tone} title={`${SEVERITY[n.severity].label}: ${n.titleTh}`}>
            {n.detailTh}
          </Banner>
        </li>
      ))}
    </ul>
  );
}