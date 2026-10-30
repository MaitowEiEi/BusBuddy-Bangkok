import { useMemo, type KeyboardEvent, type MutableRefObject } from 'react';
import type { LatLng, LiveSnapshot, TransitNetwork } from '../../types/transit';
import type { Origin } from '../../types/ui';
import { baseVariants, directionArrows, shapeFrom, vehicleLabel, type MapScene, type MapTarget } from './mapModel';

const W = 360;
const PAD = 28;

function makeProjection(points: LatLng[]) {
  const lats = points.map((p) => p[0]);
  const lngs = points.map((p) => p[1]);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const k = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const scale = (W - 2 * PAD) / ((maxLng - minLng) * k);
  const H = (maxLat - minLat) * scale + 2 * PAD;
  const project = ([lat, lng]: LatLng): [number, number] => [PAD + (lng - minLng) * k * scale, PAD + (maxLat - lat) * scale];
  return { H, project };
}

function onActivate(e: KeyboardEvent, fn: () => void) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fn();
  }
}

interface Props {
  network: TransitNetwork;
  snapshot: LiveSnapshot | null;
  scene: MapScene;
  origin: Origin | null;
  insetRef: MutableRefObject<number>;
  onSelect: (target: MapTarget) => void;
}

/** Offline-safe fallback: a simplified SVG of the same data, no tiles needed. */
export function SchematicMap({ network, snapshot, scene, origin, insetRef, onSelect }: Props) {
  const proj = useMemo(
    () => makeProjection([...network.stops.map((s) => s.position), ...network.places.map((p) => p.position)]),
    [network],
  );
  const toPath = (pts: LatLng[]) =>
    pts.map((p, i) => { const [x, y] = proj.project(p); return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`; }).join(' ');
  const inBounds = (p: LatLng) => { const [x, y] = proj.project(p); return x >= 0 && x <= W && y >= 0 && y <= proj.H; };

  const highlighted = new Set(scene.highlights.map((h) => h.variantId));
  const labelled = new Set<string>();
  if (scene.highlights.length === 0) network.stops.forEach((s) => labelled.add(s.id));
  scene.highlights.forEach((h) => network.variantById[h.variantId]?.stopIds.forEach((id) => labelled.add(id)));
  if (scene.selectedStopId) labelled.add(scene.selectedStopId);

  return (
    <div className="absolute inset-x-0 top-0 overflow-hidden bg-slate-100" style={{ bottom: insetRef.current }}>
      <svg
        viewBox={`0 0 ${W} ${Math.round(proj.H)}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full"
        role="group"
        aria-label="แผนผังเส้นทางแบบย่อ ตำแหน่งโดยประมาณ (ข้อมูลจำลอง)"
      >
        {baseVariants(network).map((v) => (
          <path
            key={v.id}
            d={toPath(v.shape)}
            fill="none"
            stroke={network.routeById[v.routeId].color}
            strokeWidth={highlighted.size ? 3 : 5}
            strokeOpacity={highlighted.size ? 0.25 : 0.7}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="cursor-pointer"
            onClick={() => onSelect({ kind: 'variant', id: v.id })}
          >
            <title>{`สาย ${network.routeById[v.routeId].shortName}`}</title>
          </path>
        ))}

        {scene.highlights.map((h) => {
          const v = network.variantById[h.variantId];
          if (!v) return null;
          const color = network.routeById[v.routeId].color;
          const pts = shapeFrom(v, h.fromStopIndex, h.toStopIndex);
          return (
            <g key={`${h.variantId}@${h.fromStopIndex}`}>
              <path d={toPath(pts)} fill="none" stroke="#fff" strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
              <path
                d={toPath(pts)}
                fill="none"
                stroke={color}
                strokeWidth={5}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="cursor-pointer"
                onClick={() => onSelect({ kind: 'variant', id: v.id })}
              />
              {directionArrows(pts).map((a, i) => {
                const [x, y] = proj.project(a.position);
                return (
                  <path
                    key={i}
                    d="M0,-6 L5,5 L0,2 L-5,5 Z"
                    transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${a.bearing.toFixed(0)})`}
                    fill={color}
                    stroke="#fff"
                    strokeWidth={1.5}
                  />
                );
              })}
            </g>
          );
        })}

        {network.stops.map((s) => {
          const [x, y] = proj.project(s.position);
          const sel = s.id === scene.selectedStopId;
          const select = () => onSelect({ kind: 'stop', id: s.id });
          return (
            <g
              key={s.id}
              role="button"
              tabIndex={0}
              aria-label={`ป้าย${s.nameTh}`}
              className="bb-svg-btn cursor-pointer"
              transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}
              onClick={select}
              onKeyDown={(e) => onActivate(e, select)}
            >
              <circle r={13} fill="transparent" />
              <circle className="bb-focus" r={sel ? 12 : 10} fill="none" stroke="transparent" strokeWidth={3} />
              <circle r={sel ? 7 : 5} fill="#fff" stroke={sel ? '#0f172a' : '#0f6b63'} strokeWidth={sel ? 4 : 2.5} />
              {labelled.has(s.id) && (
                <text x={9} y={3.5} fontSize={sel ? 11 : 9} fontWeight={sel ? 700 : 500} fill="#0f172a" stroke="#fff" strokeWidth={3} paintOrder="stroke">
                  {s.nameTh}
                </text>
              )}
            </g>
          );
        })}

        {scene.place && (() => {
          const [x, y] = proj.project(scene.place.position);
          return (
            <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
              <title>{scene.place.nameTh}</title>
              <circle r={7} fill="#dc2626" stroke="#fff" strokeWidth={3} />
            </g>
          );
        })()}

        {origin && inBounds(origin.position) && (() => {
          const [x, y] = proj.project(origin.position);
          return (
            <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
              <title>{origin.labelTh}</title>
              <circle r={10} fill="#2563eb" fillOpacity={0.2} />
              <circle r={6} fill="#2563eb" stroke="#fff" strokeWidth={3} />
            </g>
          );
        })()}

        {snapshot?.vehicles.map((vs) => {
          const route = network.routeById[vs.routeId];
          const [x, y] = proj.project(vs.position);
          const dim = highlighted.size > 0 && !highlighted.has(vs.variantId);
          const sel = vs.vehicleId === scene.selectedVehicleId;
          const flag = vs.quality === 'delayed' ? '!' : vs.quality === 'unavailable' ? '?' : '';
          const label = vehicleLabel(network, vs);
          const select = () => onSelect({ kind: 'vehicle', id: vs.vehicleId });
          return (
            <g key={vs.vehicleId} className="bb-svg-veh" style={{ transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)` }} opacity={dim ? 0.45 : 1}>
              <g role="button" tabIndex={0} aria-label={label} className="bb-svg-btn cursor-pointer" onClick={select} onKeyDown={(e) => onActivate(e, select)}>
                <title>{label}</title>
                <path d="M0,-18 L5,-12 L-5,-12 Z" transform={`rotate(${vs.bearingDeg.toFixed(0)})`} fill={route.color} />
                <circle className="bb-focus" r={14} fill="none" stroke={sel ? '#0f172a' : 'transparent'} strokeWidth={3} />
                <circle r={10.5} fill={route.color} stroke="#fff" strokeWidth={2} strokeDasharray={vs.quality !== 'live' ? '3 2' : undefined} />
                <text textAnchor="middle" y={3} fontSize={8} fontWeight={700} fill="#fff">{route.shortName}</text>
                {flag && (
                  <g transform="translate(10 -10)">
                    <circle r={6} fill="#fff" stroke="#64748b" />
                    <text textAnchor="middle" y={3} fontSize={8} fontWeight={700} fill="#0f172a">{flag}</text>
                  </g>
                )}
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}