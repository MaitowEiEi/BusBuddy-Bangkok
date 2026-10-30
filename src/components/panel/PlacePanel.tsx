import { MapPin, Navigation } from 'lucide-react';
import { useMemo } from 'react';
import { nearbyStops } from '../../domain/walking';
import { useApp } from '../../state/AppContext';
import { btn } from '../ui/buttonStyles';
import { Section } from '../ui/Section';
import { useToast } from '../ui/Toast';
import { NotFoundPanel, PanelHeader } from './PanelHeader';
import { StopRow } from './StopRow';

export function PlacePanel({ placeId }: { placeId: string }) {
  const { network, setOrigin, goHome, navigate } = useApp();
  const toast = useToast();
  const place = network.placeById[placeId];
  const near = useMemo(() => (place ? nearbyStops(network, place.position, 800, 4) : []), [network, place]);

  if (!place) return <NotFoundPanel title="ไม่พบสถานที่นี้" />;

  const setAsOrigin = () => {
    setOrigin({ kind: 'place', refId: place.id, position: place.position, labelTh: place.nameTh });
    toast(`ตั้ง${place.nameTh}เป็นจุดเริ่มต้นแล้ว`, 'success');
    goHome();
  };

  return (
    <div className="space-y-5 pb-8">
      <PanelHeader title={place.nameTh} subtitle={`${place.categoryTh} · ใช้เป็นจุดอ้างอิงในต้นแบบ`} />
      <div className="grid gap-2 px-4">
        <button type="button" onClick={() => navigate({ kind: 'plan', toPlaceId: place.id })} className={`${btn.primary} w-full`}>
          <Navigation aria-hidden className="h-4 w-4" />
          ไปที่นี่ (วางแผนการเดินทาง)
        </button>
        <button type="button" onClick={setAsOrigin} className={`${btn.secondary} w-full`}>
          <MapPin aria-hidden className="h-4 w-4" />
          ใช้ที่นี่เป็นจุดเริ่มต้น
        </button>
      </div>
      <Section title="ป้ายใกล้สถานที่นี้">
        {near.length === 0 ? (
          <p className="px-4 text-sm text-ink-soft">ไม่มีป้ายในข้อมูลจำลองภายในระยะ 800 ม.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {near.map((n) => <StopRow key={n.stop.id} stop={n.stop} distanceM={n.distanceM} walkMin={n.walkMin} />)}
          </ul>
        )}
      </Section>
    </div>
  );
}