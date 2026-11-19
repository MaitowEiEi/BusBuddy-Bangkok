import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

maplibregl.setWorkerUrl(workerUrl);

import type { GeoJSONSource, Map as MlMap, Marker } from 'maplibre-gl';

import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { stopLabel } from '../../domain/lookup';
import { prefersReducedMotion } from '../../hooks/useMediaQuery';
import { pickName, useLang, useT, type Lang } from '../../lib/i18n';
import { activeProvider } from '../../services/activeProvider';
import type { LatLng, LiveSnapshot, TransitNetwork } from '../../types/transit';
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

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const PITCH = 55;
const BUILDINGS_MIN_ZOOM = 15;
/** MapLibre zoom is about one level below Leaflet's at the same scale; mapModel thresholds use Leaflet zoom. */
const LEAFLET_ZOOM_OFFSET = 1;
const VEHICLES_MIN_ZOOM = 14;
const VEHICLE_LABEL_ZOOM = 15;

type Coord = [number, number]; // [lon, lat]
type Geometry = { type: 'LineString'; coordinates: Coord[] } | { type: 'Polygon'; coordinates: Coord[][] };
interface Feature {
  type: 'Feature';
  properties: Record<string, string | number>;
  geometry: Geometry;
}
interface Viewport {
  zoom: number;
  contains: (p: LatLng) => boolean;
}

const collection = (features: Feature[]) => ({ type: 'FeatureCollection' as const, features });
const toCoord = (p: LatLng): Coord => [p[1], p[0]];
const lineFeature = (pts: LatLng[], properties: Record<string, string | number> = {}): Feature => ({
  type: 'Feature',
  properties,
  geometry: { type: 'LineString', coordinates: pts.map(toCoord) },
});

function circleFeature(center: LatLng, radiusM: number): Feature {
  const ring: Coord[] = [];
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * 2 * Math.PI;
    const dLat = (radiusM / 110540) * Math.cos(a);
    const dLon = (radiusM / (111320 * Math.cos((center[0] * Math.PI) / 180))) * Math.sin(a);
    ring.push([center[1] + dLon, center[0] + dLat]);
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } };
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function setData(map: MlMap, id: string, features: Feature[]) {
  (map.getSource(id) as GeoJSONSource | undefined)?.setData(collection(features));
}

function markerEl(className: string, size: number, html: string): HTMLDivElement {
  const el = document.createElement('div');
  el.className = className;
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.transition = 'none'; // Leaflet marker transitions would make markers lag while panning
  el.innerHTML = html;
  return el;
}

function clickable(el: HTMLElement, label: string, onActivate: () => void) {
  el.setAttribute('role', 'button');
  el.tabIndex = 0;
  el.setAttribute('aria-label', label);
  el.title = label;
  el.style.cursor = 'pointer';
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    onActivate();
  });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onActivate();
    }
  });
}

/** Replaces the style's own 3D layer with plain grey boxes that appear only when zoomed in. */
function addBuildings(map: MlMap) {
  const layers = map.getStyle().layers ?? [];
  for (const l of layers) if (l.type === 'fill-extrusion') map.removeLayer(l.id);
  const building = layers.find((l) => 'source-layer' in l && l['source-layer'] === 'building');
  if (!building || !('source' in building)) return;
  const firstLabel = layers.find((l) => l.type === 'symbol')?.id;
  map.addLayer(
    {
      id: 'bb-buildings-3d',
      type: 'fill-extrusion',
      source: building.source,
      'source-layer': 'building',
      minzoom: BUILDINGS_MIN_ZOOM,
      paint: {
        'fill-extrusion-color': '#d6dde6',
        'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 8],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-opacity': ['interpolate', ['linear'], ['zoom'], BUILDINGS_MIN_ZOOM, 0, BUILDINGS_MIN_ZOOM + 0.5, 0.85],
      },
    },
    firstLabel,
  );
}

function addOverlayLayers(map: MlMap) {
  for (const id of ['bb-accuracy', 'bb-routes', 'bb-hl', 'bb-walks']) {
    map.addSource(id, { type: 'geojson', data: collection([]) });
  }
  const round = { 'line-cap': 'round', 'line-join': 'round' } as const;
  map.addLayer({ id: 'bb-accuracy', type: 'fill', source: 'bb-accuracy', paint: { 'fill-color': '#2563eb', 'fill-opacity': 0.08 } });
  map.addLayer({
    id: 'bb-routes', type: 'line', source: 'bb-routes', layout: round,
    paint: { 'line-color': ['get', 'color'], 'line-width': ['get', 'width'], 'line-opacity': ['get', 'opacity'] },
  });
  map.addLayer({ id: 'bb-hl-casing', type: 'line', source: 'bb-hl', layout: round, paint: { 'line-color': '#ffffff', 'line-width': 10, 'line-opacity': 0.9 } });
  map.addLayer({ id: 'bb-hl', type: 'line', source: 'bb-hl', layout: round, paint: { 'line-color': ['get', 'color'], 'line-width': 6 } });
  map.addLayer({
    id: 'bb-walks', type: 'line', source: 'bb-walks', layout: round,
    paint: { 'line-color': '#334155', 'line-width': 4, 'line-dasharray': [0, 2] },
  });
}

/** Map labels in the app language, falling back to the local (Thai) name. Road shields are left alone. */
function applyLabelLanguage(map: MlMap, lang: Lang) {
  for (const l of map.getStyle().layers ?? []) {
    if (l.type !== 'symbol' || l.id.startsWith('bb-')) continue;
    const field = map.getLayoutProperty(l.id, 'text-field');
    if (!field || !JSON.stringify(field).includes('name')) continue;
    map.setLayoutProperty(l.id, 'text-field', ['coalesce', ['get', `name:${lang}`], ['get', 'name']]);
  }
}

export function MapLibreMap({ network, snapshot, scene, fitKey, origin, insetRef, onSelect, onTilesFailed }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const stopMarkers = useRef<Marker[]>([]);
  const arrowMarkers = useRef<Marker[]>([]);
  const overlayMarkers = useRef<Marker[]>([]);
  const vehicleMarkers = useRef(new Map<string, { marker: Marker; el: HTMLDivElement; html: string }>());
  const onSelectRef = useRef(onSelect);
  const onFailRef = useRef(onTilesFailed);
  const sceneRef = useRef(scene);
  onSelectRef.current = onSelect;
  onFailRef.current = onTilesFailed;
  sceneRef.current = scene;

  const lang = useLang();
  const tr = useT();
  const [ready, setReady] = useState(false);
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const ranked = useMemo(() => rankedStops(network), [network]);

  const highlightKey = scene.highlights.map((h) => `${h.variantId}@${h.fromStopIndex}-${h.toStopIndex ?? 'end'}`).join('|');
  const walkKey = scene.walks.map((w) => w.map((p) => p.join(',')).join(';')).join('|');
  const { selectedStopId, selectedVehicleId, place, focused } = scene;
  const zoomedOut = (viewport?.zoom ?? 13) < 13;

  // Create the map once.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const vehicles = vehicleMarkers.current;
    let map: MlMap;
    try {
      map = new maplibregl.Map({
        container: el,
        style: STYLE_URL,
        center: [100.54, 13.758],
        zoom: 13,
        pitch: PITCH,
        maxPitch: 70,
        dragRotate: false, // north stays up, so bus direction arrows stay correct
        attributionControl: false,
      });
    } catch {
      onFailRef.current(); // no WebGL: fall back to the schematic map
      return;
    }
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');
    const credits = [
      'แผนที่ <a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a>',
      'ทางเดิน <a href="https://routing.openstreetmap.de" target="_blank" rel="noreferrer">FOSSGIS</a>',
    ];
    if (activeProvider.id !== 'mock') {
      credits.unshift('ข้อมูลเส้นทาง &copy; <a href="https://namtang-api.otp.go.th/opendata" target="_blank" rel="noreferrer">สนข.</a> (CC BY 4.0)');
    }
    map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: credits }), 'top-right');

    let loaded = false;
    let failed = false;
    let errors = 0;
    const fail = () => {
      if (loaded || failed) return;
      failed = true;
      onFailRef.current();
    };
    map.on('error', () => {
      errors += 1;
      if (errors >= 4) fail();
    });
    const failTimer = window.setTimeout(fail, 15000);

    map.on('load', () => {
      loaded = true;
      addBuildings(map);
      addOverlayLayers(map);
      for (const id of ['bb-routes', 'bb-hl']) {
        map.on('click', id, (e) => {
          const vid = e.features?.[0]?.properties?.variantId;
          if (typeof vid === 'string') onSelectRef.current({ kind: 'variant', id: vid });
        });
        map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; });
      }
      setReady(true);
    });

    const updateViewport = () => {
      const b = map.getBounds();
      const padX = (b.getEast() - b.getWest()) * 0.2;
      const padY = (b.getNorth() - b.getSouth()) * 0.2;
      const [w, e, s, n] = [b.getWest() - padX, b.getEast() + padX, b.getSouth() - padY, b.getNorth() + padY];
      setViewport({ zoom: map.getZoom(), contains: ([lat, lon]) => lon >= w && lon <= e && lat >= s && lat <= n });
    };
    map.on('moveend', updateViewport);
    updateViewport();

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(el);
    mapRef.current = map;

    return () => {
      window.clearTimeout(failTimer);
      ro.disconnect();
      vehicles.clear();
      mapRef.current = null;
      setReady(false);
      map.remove(); // also removes every marker
    };
  }, []);

  // Map labels follow the app language.
  useEffect(() => {
    const map = mapRef.current;
    if (ready && map) applyLabelLanguage(map, lang);
  }, [ready, lang]);

  // Route lines, highlights, direction arrows and walking paths.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const { highlights, walks, focused: isFocused } = sceneRef.current;

    const base: Feature[] = [];
    if (!isFocused) {
      for (const v of baseVariants(network)) {
        const route = network.routeById[v.routeId];
        if (!route) continue;
        const rail = route.mode !== undefined && route.mode !== 'bus';
        base.push(lineFeature(v.shape, {
          color: route.color,
          width: (zoomedOut ? 2 : 3) + (rail ? 2 : 0),
          opacity: rail ? 0.85 : 0.55,
          variantId: v.id,
        }));
      }
    }

    for (const m of arrowMarkers.current) m.remove();
    const arrows: Marker[] = [];
    const hl: Feature[] = [];
    for (const h of highlights) {
      const v = network.variantById[h.variantId];
      const route = v && network.routeById[v.routeId];
      if (!v || !route) continue;
      const pts = shapeFrom(v, h.fromStopIndex, h.toStopIndex);
      hl.push(lineFeature(pts, { color: route.color, variantId: v.id }));
      for (const a of directionArrows(pts)) {
        const el = markerEl(
          'bb-arrow-icon',
          18,
          `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 3 L20 20 L12 15 L4 20 Z" fill="${route.color}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>`,
        );
        el.style.pointerEvents = 'none';
        arrows.push(
          new maplibregl.Marker({ element: el, rotation: a.bearing, rotationAlignment: 'map', pitchAlignment: 'map' })
            .setLngLat(toCoord(a.position))
            .addTo(map),
        );
      }
    }
    arrowMarkers.current = arrows;

    setData(map, 'bb-routes', base);
    setData(map, 'bb-hl', hl);
    setData(map, 'bb-walks', walks.map((w) => lineFeature(w)));
  }, [network, highlightKey, walkKey, focused, zoomedOut, ready]);

  // Stops: same selection rules as the 2D map.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !viewport) return;
    for (const m of stopMarkers.current) m.remove();
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
      for (const id of [v.stopIds[from], v.stopIds[to]]) if (id) must.add(id);
    }

    const shown = pickStops(network, ranked, {
      zoom: viewport.zoom + LEAFLET_ZOOM_OFFSET,
      contains: viewport.contains,
      candidates: isFocused ? inScene : null,
      must,
    });

    stopMarkers.current = shown.map((s) => {
      const selected = s.id === selectedStopId;
      const name = pickName(lang, s.nameTh, s.nameEn);
      const label = selected
        ? `<div style="position:absolute;bottom:100%;left:50%;transform:translateX(-50%);margin-bottom:4px;white-space:nowrap;background:#fff;padding:2px 8px;border-radius:8px;font-size:12px;font-weight:600;box-shadow:0 1px 4px rgba(0,0,0,.25)">${escapeHtml(name)}</div>`
        : '';
      const el = markerEl('bb-stop-icon', 28, `<div class="bb-stop${selected ? ' bb-stop--selected' : ''}"><span></span></div>${label}`);
      el.style.zIndex = selected ? '3' : '1';
      clickable(el, stopLabel(network, s, lang), () => onSelectRef.current({ kind: 'stop', id: s.id }));
      return new maplibregl.Marker({ element: el }).setLngLat(toCoord(s.position)).addTo(map);
    });
  }, [network, ranked, selectedStopId, highlightKey, focused, viewport, lang]);

  // Vehicles: move existing markers so focus survives the 5-second refresh.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !snapshot) return;
    const { highlights, focused: isFocused } = sceneRef.current;
    const zoom = viewport?.zoom ?? 13;
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
        (isFocused ? routeFilter.has(vs.routeId) : zoom >= VEHICLES_MIN_ZOOM && (!viewport || viewport.contains(vs.position)));
      if (!visible) continue;
      seen.add(vs.vehicleId);

      const compact = !selected && !isFocused && zoom < VEHICLE_LABEL_ZOOM;
      const cls = ['bb-veh', selected ? 'bb-veh--selected' : '', vs.quality !== 'live' ? 'bb-veh--stale' : ''].filter(Boolean).join(' ');
      const flag = vs.quality === 'delayed' ? '!' : vs.quality === 'unavailable' ? '?' : '';
      const html = compact
        ? `<div class="bb-veh-dot" style="--c:${route.color}"></div>`
        : `<div class="${cls}" style="--c:${route.color}">` +
          `<span class="bb-veh__arrow" style="transform:rotate(${Math.round(vs.bearingDeg)}deg)"></span>` +
          `<span class="bb-veh__body">${route.shortName}</span>` +
          (flag ? `<span class="bb-veh__flag">${flag}</span>` : '') +
          '</div>';
      const label = vehicleLabel(network, vs);

      const existing = vehicleMarkers.current.get(vs.vehicleId);
      if (existing) {
        existing.marker.setLngLat(toCoord(vs.position));
        if (existing.html !== html) {
          existing.el.innerHTML = html;
          existing.html = html;
        }
        existing.el.style.zIndex = selected ? '5' : '2';
        existing.el.setAttribute('aria-label', label);
        existing.el.title = label;
      } else {
        const el = markerEl('bb-veh-icon', 40, html);
        el.style.zIndex = selected ? '5' : '2';
        clickable(el, label, () => onSelectRef.current({ kind: 'vehicle', id: vs.vehicleId }));
        const marker = new maplibregl.Marker({ element: el }).setLngLat(toCoord(vs.position)).addTo(map);
        vehicleMarkers.current.set(vs.vehicleId, { marker, el, html });
      }
    }
    for (const [id, entry] of vehicleMarkers.current) {
      if (!seen.has(id)) {
        entry.marker.remove();
        vehicleMarkers.current.delete(id);
      }
    }
  }, [network, snapshot, selectedVehicleId, highlightKey, focused, viewport, lang]);

  // Origin, GPS accuracy circle and selected place.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const m of overlayMarkers.current) m.remove();
    const added: Marker[] = [];
    if (origin) {
      const el = markerEl('bb-origin-icon', 22, '<div class="bb-origin"></div>');
      el.style.zIndex = '4';
      added.push(new maplibregl.Marker({ element: el }).setLngLat(toCoord(origin.position)).addTo(map));
    }
    if (place) {
      const el = markerEl('bb-place-icon', 26, '<div class="bb-place"></div>');
      el.style.zIndex = '4';
      added.push(new maplibregl.Marker({ element: el, anchor: 'bottom', offset: [0, 4] }).setLngLat(toCoord(place.position)).addTo(map));
    }
    overlayMarkers.current = added;
    if (ready) setData(map, 'bb-accuracy', origin?.accuracyM ? [circleFeature(origin.position, origin.accuracyM)] : []);
  }, [origin, place, ready]);

  // Fit only when the view changes, never on the periodic refresh.
  useEffect(() => {
    const id = window.setTimeout(() => {
      const map = mapRef.current;
      const pts = sceneRef.current.fitPoints;
      if (!map || pts.length === 0) return;
      let [w, e, s, n] = [180, -180, 90, -90];
      for (const [lat, lon] of pts) {
        w = Math.min(w, lon);
        e = Math.max(e, lon);
        s = Math.min(s, lat);
        n = Math.max(n, lat);
      }
      const bottom = Math.min(insetRef.current, map.getContainer().clientHeight * 0.65);
      map.fitBounds([[w, s], [e, n]], {
        padding: { top: 56, left: 56, right: 40, bottom: bottom + 32 },
        maxZoom: 16,
        duration: prefersReducedMotion() ? 0 : 700,
      });
    }, 80);
    return () => window.clearTimeout(id);
  }, [fitKey, insetRef]);

  return (
    <div
      ref={containerRef}
      className="bb-map h-full w-full"
      role="region"
      aria-label={tr('แผนที่ 3 มิติ เส้นทางรถเมล์ (ข้อมูลรถจำลอง)', '3D bus map (simulated bus data)')}
    />
  );
}