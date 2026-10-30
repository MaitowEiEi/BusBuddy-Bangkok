import L from 'leaflet';
import { useEffect, useRef, type MutableRefObject } from 'react';
import { prefersReducedMotion } from '../../hooks/useMediaQuery';
import type { LiveSnapshot, TransitNetwork } from '../../types/transit';
import type { Origin } from '../../types/ui';
import { baseVariants, directionArrows, shapeFrom, vehicleLabel, type MapScene, type MapTarget } from './mapModel';

interface Props {
  network: TransitNetwork;
  snapshot: LiveSnapshot | null;
  scene: MapScene;
  fitKey: string;
  origin: Origin | null;
  insetRef: MutableRefObject<number>;
  onSelect: (target: MapTarget) => void;
  onTilesFailed: () => void;
}

interface Layers { routes: L.LayerGroup; stops: L.LayerGroup; vehicles: L.LayerGroup; overlay: L.LayerGroup }

function arrowIcon(color: string, bearing: number): L.DivIcon {
  return L.divIcon({
    className: 'bb-arrow-icon',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    html: `<div class="bb-arrow" style="transform:rotate(${Math.round(bearing)}deg)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 L20 20 L12 15 L4 20 Z" fill="${color}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg></div>`,
  });
}

export function LeafletMap({ network, snapshot, scene, fitKey, origin, insetRef, onSelect, onTilesFailed }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<Layers | null>(null);
  const vehicleMarkers = useRef(new Map<string, { marker: L.Marker; html: string }>());
  const onSelectRef = useRef(onSelect);
  const onFailRef = useRef(onTilesFailed);
  const sceneRef = useRef(scene);
  onSelectRef.current = onSelect;
  onFailRef.current = onTilesFailed;
  sceneRef.current = scene;

  const highlightKey = scene.highlights.map((h) => `${h.variantId}@${h.fromStopIndex}-${h.toStopIndex ?? 'end'}`).join('|');
  const { selectedStopId, selectedVehicleId, place } = scene;

  // Create the map once; tear everything down on unmount.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const map = L.map(el, { center: [13.758, 100.54], zoom: 14, zoomControl: false, attributionControl: false });
    L.control.zoom({ position: 'topleft', zoomInTitle: 'ขยายแผนที่', zoomOutTitle: 'ย่อแผนที่' }).addTo(map);
    L.control.attribution({ position: 'topright', prefix: false }).addTo(map);

    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    let loaded = false;
    let failed = false;
    let errors = 0;
    const fail = () => {
      if (loaded || failed) return;
      failed = true;
      onFailRef.current();
    };
    tiles.on('tileload', () => { loaded = true; });
    tiles.on('tileerror', () => { errors += 1; if (errors >= 4) fail(); });
    const failTimer = window.setTimeout(fail, 10000);

    let noAnimTimer = 0;
    map.on('zoomstart', () => { window.clearTimeout(noAnimTimer); el.classList.add('bb-noanim'); });
    map.on('zoomend', () => { noAnimTimer = window.setTimeout(() => el.classList.remove('bb-noanim'), 120); });

    layersRef.current = {
      routes: L.layerGroup().addTo(map),
      stops: L.layerGroup().addTo(map),
      vehicles: L.layerGroup().addTo(map),
      overlay: L.layerGroup().addTo(map),
    };
    const markers = vehicleMarkers.current;
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    mapRef.current = map;

    return () => {
      window.clearTimeout(failTimer);
      window.clearTimeout(noAnimTimer);
      ro.disconnect();
      markers.clear();
      layersRef.current = null;
      mapRef.current = null;
      map.remove();
    };
  }, []);

  // Route lines + direction arrows
  useEffect(() => {
    const g = layersRef.current?.routes;
    if (!g) return;
    g.clearLayers();
    const highlights = sceneRef.current.highlights;
    const dimmed = highlights.length > 0;
    for (const v of baseVariants(network)) {
      L.polyline(v.shape, { color: network.routeById[v.routeId].color, weight: dimmed ? 3 : 5, opacity: dimmed ? 0.25 : 0.7 })
        .on('click', () => onSelectRef.current({ kind: 'variant', id: v.id }))
        .addTo(g);
    }
    for (const h of highlights) {
      const v = network.variantById[h.variantId];
      if (!v) continue;
      const color = network.routeById[v.routeId].color;
      const pts = shapeFrom(v, h.fromStopIndex, h.toStopIndex);
      L.polyline(pts, { color: '#ffffff', weight: 10, opacity: 0.9, interactive: false }).addTo(g);
      L.polyline(pts, { color, weight: 6, opacity: 1 })
        .on('click', () => onSelectRef.current({ kind: 'variant', id: v.id }))
        .addTo(g);
      for (const a of directionArrows(pts)) {
        L.marker(a.position, { icon: arrowIcon(color, a.bearing), interactive: false, keyboard: false, zIndexOffset: -500 }).addTo(g);
      }
    }
  }, [network, highlightKey]);

  // Stops (focusable, Enter activates)
  useEffect(() => {
    const g = layersRef.current?.stops;
    if (!g) return;
    g.clearLayers();
    for (const s of network.stops) {
      const selected = s.id === selectedStopId;
      const m = L.marker(s.position, {
        icon: L.divIcon({
          className: 'bb-stop-icon',
          html: `<div class="bb-stop${selected ? ' bb-stop--selected' : ''}"><span></span></div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
        title: `ป้าย${s.nameTh}`,
        keyboard: true,
        zIndexOffset: selected ? 500 : 0,
      });
      m.on('click', () => onSelectRef.current({ kind: 'stop', id: s.id }));
      m.bindTooltip(s.nameTh, { direction: 'top', offset: [0, -12], permanent: selected });
      m.addTo(g);
      m.getElement()?.setAttribute('aria-label', `ป้าย${s.nameTh}`);
    }
  }, [network, selectedStopId]);

  // Vehicles: update existing markers in place so focus and selection survive refreshes
  useEffect(() => {
    const g = layersRef.current?.vehicles;
    if (!g || !snapshot) return;
    const highlighted = new Set(sceneRef.current.highlights.map((h) => h.variantId));
    const seen = new Set<string>();

    for (const vs of snapshot.vehicles) {
      seen.add(vs.vehicleId);
      const route = network.routeById[vs.routeId];
      const selected = vs.vehicleId === selectedVehicleId;
      const cls = [
        'bb-veh',
        highlighted.size > 0 && !highlighted.has(vs.variantId) ? 'bb-veh--dim' : '',
        selected ? 'bb-veh--selected' : '',
        vs.quality !== 'live' ? 'bb-veh--stale' : '',
      ].filter(Boolean).join(' ');
      const flag = vs.quality === 'delayed' ? '!' : vs.quality === 'unavailable' ? '?' : '';
      const html =
        `<div class="${cls}" style="--c:${route.color}">` +
        `<span class="bb-veh__arrow" style="transform:rotate(${Math.round(vs.bearingDeg)}deg)"></span>` +
        `<span class="bb-veh__body">${route.shortName}</span>` +
        (flag ? `<span class="bb-veh__flag">${flag}</span>` : '') +
        '</div>';
      const label = vehicleLabel(network, vs);
      const zIndex = selected ? 2000 : 1000;

      const existing = vehicleMarkers.current.get(vs.vehicleId);
      if (existing) {
        existing.marker.setLatLng(vs.position);
        existing.marker.setZIndexOffset(zIndex);
        const el = existing.marker.getElement();
        if (el && existing.html !== html) {
          el.innerHTML = html;
          existing.html = html;
        }
        el?.setAttribute('aria-label', label);
        el?.setAttribute('title', label);
      } else {
        const marker = L.marker(vs.position, {
          icon: L.divIcon({ className: 'bb-veh-icon', html, iconSize: [40, 40], iconAnchor: [20, 20] }),
          keyboard: true,
          title: label,
          zIndexOffset: zIndex,
        });
        marker.on('click', () => onSelectRef.current({ kind: 'vehicle', id: vs.vehicleId }));
        marker.addTo(g);
        marker.getElement()?.setAttribute('aria-label', label);
        vehicleMarkers.current.set(vs.vehicleId, { marker, html });
      }
    }
    for (const [id, entry] of vehicleMarkers.current) {
      if (!seen.has(id)) {
        g.removeLayer(entry.marker);
        vehicleMarkers.current.delete(id);
      }
    }
  }, [network, snapshot, selectedVehicleId, highlightKey]);

  // Origin + selected place
  useEffect(() => {
    const g = layersRef.current?.overlay;
    if (!g) return;
    g.clearLayers();
    if (origin) {
      if (origin.accuracyM) {
        L.circle(origin.position, { radius: origin.accuracyM, color: '#2563eb', weight: 1, fillOpacity: 0.08, interactive: false }).addTo(g);
      }
      L.marker(origin.position, {
        icon: L.divIcon({ className: 'bb-origin-icon', html: '<div class="bb-origin"></div>', iconSize: [22, 22], iconAnchor: [11, 11] }),
        interactive: false,
        keyboard: false,
        zIndexOffset: 800,
      }).addTo(g);
    }
    if (place) {
      L.marker(place.position, {
        icon: L.divIcon({ className: 'bb-place-icon', html: '<div class="bb-place"></div>', iconSize: [26, 26], iconAnchor: [13, 30] }),
        interactive: false,
        keyboard: false,
        zIndexOffset: 900,
      }).addTo(g);
    }
  }, [origin, place]);

  // Fit only when the view or origin changes — never on periodic refreshes.
  useEffect(() => {
    const id = window.setTimeout(() => {
      const map = mapRef.current;
      const pts = sceneRef.current.fitPoints;
      if (!map || pts.length === 0) return;
      const bottom = Math.min(insetRef.current, map.getSize().y * 0.65);
      map.fitBounds(L.latLngBounds(pts), {
        paddingTopLeft: [56, 56],
        paddingBottomRight: [40, bottom + 32],
        maxZoom: 16,
        animate: !prefersReducedMotion(),
      });
    }, 80);
    return () => window.clearTimeout(id);
  }, [fitKey, insetRef]);

  return <div ref={containerRef} className="bb-map h-full w-full" role="region" aria-label="แผนที่เส้นทางรถเมล์ (ข้อมูลรถจำลอง)" />;
}