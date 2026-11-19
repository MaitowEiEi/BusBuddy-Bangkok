import { MapPin, Navigation } from 'lucide-react';
import { useMemo } from 'react';
import { nearbyStops } from '../../domain/walking';
import { pickName, useLang, useT } from '../../lib/i18n';
import { useApp } from '../../state/AppContext';
import { btn } from '../ui/buttonStyles';
import { Section } from '../ui/Section';
import { useToast } from '../ui/Toast';
import { NotFoundPanel, PanelHeader } from './PanelHeader';
import { StopRow } from './StopRow';

export function PlacePanel({ placeId }: { placeId: string }) {
  const { network, setOrigin, goHome, navigate } = useApp();
  const lang = useLang();
  const tr = useT();
  const toast = useToast();
  const place = network.placeById[placeId];
  const near = useMemo(
    () => (place ? nearbyStops(network, place.position, 800, 4) : []),
    [network, place],
  );

  if (!place) return <NotFoundPanel title={tr('ไม่พบสถานที่นี้', 'Place not found')} />;

  const placeName = pickName(lang, place.nameTh, (place as { nameEn?: string }).nameEn);
  const category = pickName(lang, place.categoryTh, (place as { categoryEn?: string }).categoryEn);

  const setAsOrigin = () => {
    setOrigin({ kind: 'place', refId: place.id, position: place.position, labelTh: place.nameTh });
    toast(
      tr(`ตั้ง${place.nameTh}เป็นจุดเริ่มต้นแล้ว`, `Set ${placeName} as starting point`),
      'success',
    );
    goHome();
  };

  return (
    <div className="space-y-5 pb-8">
      <PanelHeader
        title={placeName}
        subtitle={tr(
          `${category} · ใช้เป็นจุดอ้างอิงในต้นแบบ`,
          `${category} · Reference landmark in prototype`,
        )}
      />

      <div className="grid gap-2 px-4">
        <button
          type="button"
          onClick={() => navigate({ kind: 'plan', toPlaceId: place.id })}
          className={`${btn.primary} w-full`}
        >
          <Navigation aria-hidden className="h-4 w-4" />
          {tr('ไปที่นี่ (วางแผนการเดินทาง)', 'Directions here (Plan trip)')}
        </button>
        <button type="button" onClick={setAsOrigin} className={`${btn.secondary} w-full`}>
          <MapPin aria-hidden className="h-4 w-4" />
          {tr('ใช้ที่นี่เป็นจุดเริ่มต้น', 'Use as starting point')}
        </button>
      </div>

      <Section title={tr('ป้ายใกล้สถานที่นี้', 'Stops near this place')}>
        {near.length === 0 ? (
          <p className="px-4 text-sm text-ink-soft">
            {tr('ไม่มีป้ายในข้อมูลจำลองภายในระยะ 800 ม.', 'No stops in this dataset within 800 m')}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {near.map((n) => (
              <StopRow key={n.stop.id} stop={n.stop} distanceM={n.distanceM} walkMin={n.walkMin} />
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
