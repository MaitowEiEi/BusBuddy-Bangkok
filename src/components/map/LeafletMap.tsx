import L from 'leaflet';
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { prefersReducedMotion } from '../../hooks/useMediaQuery';
import type { LiveSnapshot, TransitNetwork } from '../../types/transit';
import type { Origin } from '../../types/ui';
import {
  baseVariants, directionArrows, pickStops, rankedStops, shapeFrom, vehicleLabel, type MapScene, type MapTarget,
} from './mapModel';

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
interface Viewport { zoom: number; bounds: L.LatLngBounds }

/** Home map: buses appear from this zoom as dots, and get route numbers from VEHICLE_LABEL_ZOOM. */
const VEHICLES_MIN_ZOOM = 15;
const VEHICLE_LABEL_ZOOM = 16;

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

  const [viewport, setViewport] = useState<Viewport | null>(null);
  const ranked = useMemo(() => rankedStops(network), [network]);

  const highlightKey = scene.highlights.map((h) => `${h.variantId}@${h.fromStopIndex}-${h.toStopIndex ?? 'end'}`).join('|');
  const { selectedStopId, selectedVehicleId, place, focused } = scene;
  const zoomedOut = (viewport?.zoom ?? 14) < 14;

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

    // Redraw stops and buses for the visible area after each pan or zoom.
    const updateViewport = () => setViewport({ zoom: map.getZoom(), bounds: map.getBounds().pad(0.2) });
    map.on('moveend', updateViewport);
    updateViewport();

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

  // Route lines: all routes (thin) on the home map, only the selected ones when something is open.
  useEffect(() => {
    const g = layersRef.current?.routes;
    if (!g) return;
    g.clearLayers();
    const { highlights, focused: isFocused } = sceneRef.current;
    if (!isFocused) {
      for (const v of baseVariants(network)) {
        const route = network.routeById[v.routeId];
        if (!route) continue;
        const rail = route.mode !== undefined && route.mode !== 'bus';
        L.polyline(v.shape, {
          color: route.color,
          weight: (zoomedOut ? 2 : 3) + (rail ? 2 : 0),
          opacity: rail ? 0.85 : 0.55,
        })
          .on('click', () => onSelectRef.current({ kind: 'variant', id: v.id }))
          .addTo(g);
      }
    }
    for (const h of highlights) {
      const v = network.variantById[h.variantId];
      const route = v && network.routeById[v.routeId];
      if (!v || !route) continue;
      const pts = shapeFrom(v, h.fromStopIndex, h.toStopIndex);
      L.polyline(pts, { color: '#ffffff', weight: 10, opacity: 0.9, interactive: false }).addTo(g);
      L.polyline(pts, { color: route.color, weight: 6, opacity: 1 })
        .on('click', () => onSelectRef.current({ kind: 'variant', id: v.id }))
        .addTo(g);
      for (const a of directionArrows(pts)) {
        L.marker(a.position, { icon: arrowIcon(route.color, a.bearing), interactive: false, keyboard: false, zIndexOffset: -500 }).addTo(g);
      }
    }
  }, [network, highlightKey, focused, zoomedOut]);

  // Stops: main interchanges when zoomed out, every stop when zoomed in, only related stops when focused.
  useEffect(() => {
    const g = layersRef.current?.stops;
    if (!g || !viewport) return;
    g.clearLayers();
    const { highlights, focused: isFocused } = sceneRef.current;

    const must = new Set<string>();
    if (selectedStopId) must.add(selectedStopId);
    const inScene = new Set<string>();
    for (const h of highlights) {
      const v = network.variantById[h.variantId];
      if (!v) continue;
      const from = Math.max(0, h.fromStopIndex);
      const to = h.toStopIndex ?? v.stopIds.length - 1;
      for (const id of v.stopIds.slice(from, to + 1)) inScene.add(id);
      for (const id of [v.stopIds[from], v.stopIds[to]]) if (id) must.add(id); // board / alight / ends
    }

    const shown = pickStops(network, ranked, {
      zoom: viewport.zoom,
      contains: (p) => viewport.bounds.contains(p),
      candidates: isFocused ? inScene : null,
      must,
    });

    for (const s of shown) {
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
  }, [network, ranked, selectedStopId, highlightKey, focused, viewport]);

  // Vehicles: update existing markers in place so focus and selection survive refreshes
  useEffect(() => {
    const g = layersRef.current?.vehicles;
    if (!g || !snapshot) return;
    const { highlights, focused: isFocused } = sceneRef.current;
    const zoom = viewport?.zoom ?? 14;
    const routeFilter = new Set<string>();
    for (const h of highlights) {
      const v = network.variantById[h.variantId];
      if (v) routeFilter.add(v.routeId);
    }
    const seen = new Set<string>();

    for (const vs of snapshot.vehicles) {
      const route = network.routeById[vs.routeId];
      if (!route) continue;
      const selected = vs.vehicleId === selectedVehicleId;
      const visible =
        selected ||
        (isFocused
          ? routeFilter.has(vs.routeId)
          : zoom >= VEHICLES_MIN_ZOOM && (!viewport || viewport.bounds.contains(vs.position)));
      if (!visible) continue;
      seen.add(vs.vehicleId);

      const compact = !selected && !isFocused && zoom < VEHICLE_LABEL_ZOOM;
      const cls = ['bb-veh', selected ? 'bb-veh--selected' : '', vs.quality !== 'live' ? 'bb-veh--stale' : '']
        .filter(Boolean)
        .join(' ');
      const flag = vs.quality === 'delayed' ? '!' : vs.quality === 'unavailable' ? '?' : '';
      const html = compact
        ? `<div class="bb-veh-dot" style="--c:${route.color}"></div>`
        : `<div class="${cls}" style="--c:${route.color}">` +
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
  }, [network, snapshot, selectedVehicleId, highlightKey, focused, viewport]);

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