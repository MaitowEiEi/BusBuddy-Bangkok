import { NOTICE_EN_BY_ID } from '../data/notices';
import { pickName, useLang, useT } from '../lib/i18n';
import { useApp } from '../state/AppContext';
import type { ServiceNotice } from '../types/transit';
import { Banner, type BannerTone } from './ui/Banner';

const SEVERITY: Record<ServiceNotice['severity'], { tone: BannerTone; th: string; en: string }> = {
  info: { tone: 'info', th: 'ประกาศ', en: 'Notice' },
  warning: { tone: 'warning', th: 'คำเตือน', en: 'Warning' },
  disruption: { tone: 'disruption', th: 'เหตุขัดข้อง', en: 'Disruption' },
};

export function NoticeList({ routeIds, includeInfo = true }: { routeIds?: string[]; includeInfo?: boolean }) {
  const { snapshot } = useApp();
  const lang = useLang();
  const tr = useT();

  const notices = (snapshot?.notices ?? []).filter(
    (n) => (includeInfo || n.severity !== 'info') && (!routeIds || n.routeIds.some((id) => routeIds.includes(id))),
  );
  if (notices.length === 0) return null;

  return (
    <ul aria-label={tr('ประกาศการเดินรถ', 'Service notices')} className="space-y-2 px-4">
      {notices.map((n) => {
        const sev = SEVERITY[n.severity];
        const sevLabel = lang === 'en' ? sev.en : sev.th;
        const extra = n as ServiceNotice & { titleEn?: string; detailEn?: string };
        const fallbackEn = NOTICE_EN_BY_ID[n.id];
        const title = pickName(lang, n.titleTh, extra.titleEn ?? fallbackEn?.titleEn);
        const detail = pickName(lang, n.detailTh, extra.detailEn ?? fallbackEn?.detailEn);

        return (
          <li key={n.id}>
            <Banner tone={sev.tone} title={`${sevLabel}: ${title}`}>
              {detail}
            </Banner>
          </li>
        );
      })}
    </ul>
  );
}
