/**
 * BusBuddy Bangkok: import Namtang GTFS (OTP, Ministry of Transport) into compact JSON.
 *
 *   npm run import:namtang
 *
 * Input : data/raw/namtang-gtfs/*.txt  (gitignored, too large for GitHub)
 * Output: src/data/namtang.json        (small, safe to commit)
 *         data/namtang-report.md       (summary to check what was imported)
 *
 * Data licence: CC BY 4.0. The app must credit the publisher.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse';

const RAW_DIR = path.resolve('data/raw/namtang-gtfs');
const OUT_FILE = path.resolve('src/data/namtang.json');
const REPORT_FILE = path.resolve('data/namtang-report.md');

/** Edit these to change which routes are imported. */
const CONFIG = {
  // A bus route is imported when any stop of any of its trips is within radiusM of a hub.
  hubs: [
    { id: 'victory', nameTh: 'อนุสาวรีย์ชัยสมรภูมิ', lat: 13.76493, lon: 100.53828, radiusM: 450 },
    { id: 'siam', nameTh: 'สยาม', lat: 13.7456, lon: 100.53413, radiusM: 400 },
    { id: 'silom-saladaeng', nameTh: 'สีลม (ศาลาแดง)', lat: 13.72849, lon: 100.53436, radiusM: 400 },
    { id: 'silom-chongnonsi', nameTh: 'สีลม (ช่องนนทรี)', lat: 13.72366, lon: 100.52935, radiusM: 350 },
  ],
  busRouteTypes: ['3'],
  // TC = intercity coaches. Add agency_ids here to drop vans or provincial buses.
  excludeBusAgencies: ['TC'],
  // Rail lines from these agencies are imported whole, whatever the hubs.
  railAgencies: ['BTSC', 'BEM'],
  railRouteTypes: ['0', '1', '2'],
  // Larger = smaller file but a less accurate line on the map.
  shapeToleranceM: 8,
};

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

// ---------- helpers ----------

const clean = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
const round = (n, d) => Math.round(n * 10 ** d) / 10 ** d;
const safeCell = (s) => clean(s).replaceAll('|', '/');

function splitName(raw) {
  const [th = '', ...rest] = clean(raw).split(';');
  return { th: th.trim(), en: rest.join(';').trim() };
}

function parseTime(t) {
  const v = clean(t);
  if (!v) return null;
  const [h, m, s = 0] = v.split(':').map(Number);
  if ([h, m, s].some(Number.isNaN)) return null;
  return h * 3600 + m * 60 + s;
}

function distanceM(aLat, aLon, bLat, bLon) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

function normColor(c, fallback) {
  const hex = clean(c).replace(/^#/, '');
  return /^[0-9a-f]{6}$/i.test(hex) ? `#${hex.toUpperCase()}` : fallback;
}

function pushTo(map, key, value) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

const isRail = (r) => CONFIG.railAgencies.includes(r.agencyId) && CONFIG.railRouteTypes.includes(r.routeType);
const isBusCandidate = (r) =>
  CONFIG.busRouteTypes.includes(r.routeType) && !CONFIG.excludeBusAgencies.includes(r.agencyId);

function modeOf(r) {
  if (!isRail(r)) return 'bus';
  if (r.agencyId === 'BTSC') return 'bts';
  if (r.agencyId === 'BEM') return 'mrt';
  return 'rail';
}

async function* readCsv(name, required = true) {
  const file = path.join(RAW_DIR, `${name}.txt`);
  if (!fs.existsSync(file)) {
    if (required) throw new Error(`Missing ${name}.txt in ${RAW_DIR}`);
    console.warn(`  (skip) ${name}.txt not found`);
    return;
  }
  const parser = fs.createReadStream(file).pipe(
    parse({
      columns: (header) => header.map((h) => h.trim()),
      bom: true,
      trim: true,
      relax_column_count: true,
      relax_quotes: true,
      skip_empty_lines: true,
    }),
  );
  for await (const row of parser) yield row;
}

async function readAll(name, required = true) {
  const rows = [];
  for await (const row of readCsv(name, required)) rows.push(row);
  return rows;
}

/** Fill missing stop times by linear interpolation between known ones. */
function fillTimes(values) {
  const known = values.map((v, i) => (v == null ? -1 : i)).filter((i) => i >= 0);
  if (known.length === 0) return null;
  const out = [...values];
  for (let i = 0; i < known[0]; i++) out[i] = values[known[0]];
  for (let k = 0; k < known.length - 1; k++) {
    const a = known[k];
    const b = known[k + 1];
    for (let i = a + 1; i < b; i++) out[i] = values[a] + ((values[b] - values[a]) * (i - a)) / (b - a);
  }
  const last = known[known.length - 1];
  for (let i = last + 1; i < out.length; i++) out[i] = values[last];
  return out;
}

/** Douglas-Peucker simplification in metres. points: [lat, lon][] */
function simplify(points, tolM) {
  if (points.length <= 2) return points;
  const kx = 111320 * Math.cos((points[0][0] * Math.PI) / 180);
  const ky = 110540;
  const xy = points.map(([lat, lon]) => [lon * kx, lat * ky]);
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [a, b] = stack.pop();
    const [ax, ay] = xy[a];
    const [bx, by] = xy[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let maxD = 0;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = xy[i];
      let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(ax + t * dx - px, ay + t * dy - py);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (idx !== -1 && maxD > tolM) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** Google encoded polyline, precision 5. */
function encodePolyline(points) {
  const enc = (v) => {
    let s = v < 0 ? ~(v << 1) : v << 1;
    let r = '';
    while (s >= 0x20) {
      r += String.fromCharCode((0x20 | (s & 0x1f)) + 63);
      s >>= 5;
    }
    return r + String.fromCharCode(s + 63);
  };
  let out = '';
  let pLat = 0;
  let pLon = 0;
  for (const [lat, lon] of points) {
    const iLat = Math.round(lat * 1e5);
    const iLon = Math.round(lon * 1e5);
    out += enc(iLat - pLat) + enc(iLon - pLon);
    pLat = iLat;
    pLon = iLon;
  }
  return out;
}

// ---------- main ----------

async function main() {
  const startedAt = Date.now();
  const log = (msg) => console.log(`[${((Date.now() - startedAt) / 1000).toFixed(1)}s] ${msg}`);
  const warnings = [];

  if (!fs.existsSync(path.join(RAW_DIR, 'stops.txt'))) {
    throw new Error(`stops.txt not found in ${RAW_DIR}. Extract namtang-gtfs.zip there first.`);
  }

  // 1. Small reference files
  const feed = (await readAll('feed_info', false))[0] ?? {};

  const agencies = new Map();
  for (const r of await readAll('agency')) {
    const n = splitName(r.agency_name);
    agencies.set(r.agency_id, { id: r.agency_id, nameTh: n.th, nameEn: n.en });
  }

  const routes = new Map();
  for (const r of await readAll('routes')) {
    const long = splitName(r.route_long_name);
    routes.set(r.route_id, {
      id: r.route_id,
      agencyId: r.agency_id,
      shortName: clean(r.route_short_name),
      longNameTh: long.th,
      longNameEn: long.en,
      descTh: splitName(r.route_desc).th,
      routeType: clean(r.route_type),
      color: r.route_color,
    });
  }
  log(`routes: ${routes.size}`);

  const stops = new Map();
  for (const r of await readAll('stops')) {
    const lat = Number(r.stop_lat);
    const lon = Number(r.stop_lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const n = splitName(r.stop_name);
    stops.set(r.stop_id, {
      id: r.stop_id,
      nameTh: n.th,
      nameEn: n.en,
      lat,
      lon,
      zone: clean(r.zone_id),
      wheelchair: Number(r.wheelchair_boarding) || 0,
    });
  }
  log(`stops: ${stops.size}`);

  const stopHubs = new Map();
  for (const s of stops.values()) {
    const hits = CONFIG.hubs.filter((h) => distanceM(s.lat, s.lon, h.lat, h.lon) <= h.radiusM).map((h) => h.id);
    if (hits.length > 0) stopHubs.set(s.id, hits);
  }
  log(`stops near hubs: ${stopHubs.size}`);

  // 2. Trips of candidate routes, with their stop sequences
  const trips = new Map();
  for (const r of await readAll('trips')) {
    const route = routes.get(r.route_id);
    if (!route || !(isRail(route) || isBusCandidate(route))) continue;
    const h = splitName(r.trip_headsign);
    trips.set(r.trip_id, {
      id: r.trip_id,
      routeId: r.route_id,
      serviceId: clean(r.service_id),
      directionId: clean(r.direction_id) || '0',
      shapeId: clean(r.shape_id),
      headsignTh: h.th,
      headsignEn: h.en,
      wheelchair: Number(r.wheelchair_accessible) || 0,
      stops: [],
    });
  }

  let unknownStopRows = 0;
  for await (const r of readCsv('stop_times')) {
    const trip = trips.get(r.trip_id);
    if (!trip) continue;
    if (!stops.has(r.stop_id)) {
      unknownStopRows++;
      continue;
    }
    trip.stops.push({
      seq: Number(r.stop_sequence),
      stopId: r.stop_id,
      arr: parseTime(r.arrival_time),
      dep: parseTime(r.departure_time),
    });
  }
  for (const t of trips.values()) t.stops.sort((a, b) => a.seq - b.seq);
  if (unknownStopRows > 0) warnings.push(`stop_times อ้างถึงป้ายที่ไม่มีใน stops.txt ${unknownStopRows} แถว (ข้ามไป)`);
  log(`candidate trips: ${trips.size}`);

  // 3. Select routes: rail by agency, buses by hubs
  const routeHubs = new Map();
  for (const t of trips.values()) {
    if (t.stops.length < 2) continue;
    const route = routes.get(t.routeId);
    if (isRail(route)) {
      if (!routeHubs.has(route.id)) routeHubs.set(route.id, new Set());
      continue;
    }
    for (const s of t.stops) {
      const hits = stopHubs.get(s.stopId);
      if (!hits) continue;
      if (!routeHubs.has(route.id)) routeHubs.set(route.id, new Set());
      for (const h of hits) routeHubs.get(route.id).add(h);
    }
  }
  log(`selected routes: ${routeHubs.size}`);

  const tripsByRoute = new Map();
  for (const t of trips.values()) {
    if (routeHubs.has(t.routeId) && t.stops.length >= 2) pushTo(tripsByRoute, t.routeId, t);
  }

  // 4. Frequencies
  const freqByTrip = new Map();
  for (const r of await readAll('frequencies', false)) {
    const t = trips.get(r.trip_id);
    if (!t || !routeHubs.has(t.routeId)) continue;
    const start = parseTime(r.start_time);
    const end = parseTime(r.end_time);
    const headway = Number(r.headway_secs);
    if (start == null || end == null || !(headway > 0)) continue;
    pushTo(freqByTrip, r.trip_id, [start, end, headway]);
  }

  // 5. Variants = route + direction + exact stop sequence
  const variants = [];
  const usedStops = new Set();
  const usedShapes = new Set();
  const usedServices = new Set();
  let variantsWithoutTimes = 0;

  for (const [routeId, routeTrips] of tripsByRoute) {
    const groups = new Map();
    for (const t of routeTrips) pushTo(groups, `${t.directionId}|${t.stops.map((s) => s.stopId).join(',')}`, t);
    const ordered = [...groups.values()].sort((a, b) => b[0].stops.length - a[0].stops.length);

    const routeVariants = ordered.map((group, i) => {
      const rep = group.find((t) => freqByTrip.has(t.id)) ?? group[0];
      const arr = fillTimes(rep.stops.map((s) => s.arr ?? s.dep));
      const dep = fillTimes(rep.stops.map((s) => s.dep ?? s.arr));
      if (!arr) variantsWithoutTimes++;
      const base = arr ? arr[0] : 0;

      const services = {};
      for (const t of group) {
        usedServices.add(t.serviceId);
        const svc = (services[t.serviceId] ??= { periods: [], departures: [] });
        const freq = freqByTrip.get(t.id);
        if (freq) svc.periods.push(...freq);
        else {
          const first = t.stops[0].dep ?? t.stops[0].arr;
          if (first != null) svc.departures.push(first);
        }
      }
      for (const svc of Object.values(services)) {
        const seen = new Set();
        svc.periods = svc.periods
          .filter((p) => {
            const k = p.join(',');
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          })
          .sort((a, b) => a[0] - b[0]);
        svc.departures = [...new Set(svc.departures)].sort((a, b) => a - b);
      }

      for (const s of rep.stops) usedStops.add(s.stopId);
      if (rep.shapeId) usedShapes.add(rep.shapeId);
      const lastStop = stops.get(rep.stops[rep.stops.length - 1].stopId);

      return {
        id: `${routeId}:${rep.directionId}:${i}`,
        routeId,
        directionId: Number(rep.directionId) || 0,
        headsignTh: rep.headsignTh || lastStop.nameTh,
        headsignEn: rep.headsignEn || lastStop.nameEn,
        stopIds: rep.stops.map((s) => s.stopId),
        arrSec: arr ? arr.map((v) => Math.round(v - base)) : null,
        depSec: dep ? dep.map((v) => Math.round(v - base)) : null,
        shapeId: rep.shapeId || null,
        wheelchair: rep.wheelchair,
        isShortTurn: false,
        tripCount: group.length,
        services,
      };
    });

    // Short turn = a contiguous part of the longest variant in the same direction
    const byDir = new Map();
    for (const v of routeVariants) pushTo(byDir, v.directionId, v);
    for (const list of byDir.values()) {
      const longest = list.reduce((a, b) => (b.stopIds.length > a.stopIds.length ? b : a));
      const full = `,${longest.stopIds.join(',')},`;
      for (const v of list) {
        if (v !== longest && v.stopIds.length < longest.stopIds.length && full.includes(`,${v.stopIds.join(',')},`)) {
          v.isShortTurn = true;
        }
      }
    }
    variants.push(...routeVariants);
  }
  if (variantsWithoutTimes > 0) warnings.push(`${variantsWithoutTimes} เที่ยวย่อยไม่มีเวลาใน stop_times`);
  log(`variants: ${variants.length}, stops used: ${usedStops.size}`);

  // 6. Shapes (large file, streamed)
  const rawShapes = new Map([...usedShapes].map((id) => [id, []]));
  let shapeRows = 0;
  for await (const r of readCsv('shapes', false)) {
    if (++shapeRows % 1_000_000 === 0) log(`  shapes.txt: ${shapeRows.toLocaleString()} rows`);
    const pts = rawShapes.get(r.shape_id);
    if (pts) pts.push([Number(r.shape_pt_sequence), Number(r.shape_pt_lat), Number(r.shape_pt_lon)]);
  }
  const shapes = {};
  let rawPts = 0;
  let keptPts = 0;
  for (const [id, pts] of rawShapes) {
    if (pts.length < 2) continue;
    pts.sort((a, b) => a[0] - b[0]);
    const latlon = pts.map((p) => [p[1], p[2]]).filter(([la, lo]) => Number.isFinite(la) && Number.isFinite(lo));
    const simp = simplify(latlon, CONFIG.shapeToleranceM);
    rawPts += latlon.length;
    keptPts += simp.length;
    shapes[id] = encodePolyline(simp);
  }
  let noShape = 0;
  for (const v of variants) {
    if (v.shapeId && !shapes[v.shapeId]) v.shapeId = null;
    if (!v.shapeId) noShape++;
  }
  if (noShape > 0) warnings.push(`${noShape} เที่ยวย่อยไม่มีเส้นทางใน shapes.txt (แอปจะลากเส้นตรงระหว่างป้ายแทน)`);
  log(`shapes: ${Object.keys(shapes).length}, points ${rawPts.toLocaleString()} -> ${keptPts.toLocaleString()}`);

  // 7. Fares (large files, streamed, kept only for selected routes and their zones)
  const routeZones = new Map();
  for (const v of variants) {
    if (!routeZones.has(v.routeId)) routeZones.set(v.routeId, new Set());
    for (const id of v.stopIds) {
      const z = stops.get(id).zone;
      if (z) routeZones.get(v.routeId).add(z);
    }
  }
  const fareRules = [];
  for await (const r of readCsv('fare_rules', false)) {
    const zones = routeZones.get(r.route_id);
    if (!zones) continue;
    const o = clean(r.origin_id);
    const d = clean(r.destination_id);
    if ((o && !zones.has(o)) || (d && !zones.has(d))) continue;
    fareRules.push({ fareId: r.fare_id, routeId: r.route_id, o, d });
  }
  const neededFareIds = new Set(fareRules.map((f) => f.fareId));
  const farePrice = new Map();
  for await (const r of readCsv('fare_attributes', false)) {
    if (!neededFareIds.has(r.fare_id)) continue;
    const p = Number(r.price);
    if (Number.isFinite(p)) farePrice.set(r.fare_id, p);
  }
  // Rail keeps its zone-pair table (few stations, needed for exact fares).
  // Buses keep only min-max: their pair tables reach hundreds of thousands of rows.
  const fares = {};
  const fareSeen = new Set();
  let farePairs = 0;
  for (const f of fareRules) {
    const price = farePrice.get(f.fareId);
    if (price == null || price <= 0) continue;
    const entry = (fares[f.routeId] ??= { min: price, max: price });
    entry.min = Math.min(entry.min, price);
    entry.max = Math.max(entry.max, price);
    if ((!f.o && !f.d) || !isRail(routes.get(f.routeId))) continue;
    const key = `${f.routeId}|${f.o}|${f.d}`;
    if (fareSeen.has(key)) continue;
    fareSeen.add(key);
    (entry.pairs ??= []).push([f.o, f.d, price]);
    farePairs++;
  }
  if (farePairs > 20000) warnings.push(`ค่าโดยสารระบบรางแบบคู่โซนมี ${farePairs} คู่ ไฟล์อาจใหญ่`);
  log(`fares: ${Object.keys(fares).length} routes, ${farePairs} zone pairs`);

  // 8. Service calendars
  const services = {};
  for (const r of await readAll('calendar', false)) {
    if (!usedServices.has(r.service_id)) continue;
    services[r.service_id] = {
      days: DAYS.map((d) => (r[d] === '1' ? 1 : 0)),
      startDate: clean(r.start_date),
      endDate: clean(r.end_date),
      added: [],
      removed: [],
    };
  }
  for (const r of await readAll('calendar_dates', false)) {
    if (!usedServices.has(r.service_id)) continue;
    const s = (services[r.service_id] ??= { days: [0, 0, 0, 0, 0, 0, 0], startDate: '', endDate: '', added: [], removed: [] });
    (r.exception_type === '1' ? s.added : s.removed).push(clean(r.date));
  }

  // 9. Output
  const routeIdsWithVariants = new Set(variants.map((v) => v.routeId));
  const outRoutes = [...routeIdsWithVariants]
    .map((id) => {
      const r = routes.get(id);
      const mode = modeOf(r);
      return {
        id,
        agencyId: r.agencyId,
        shortName: r.shortName.replace(/\s*\(.+\)$/, ''),
        legacyName: r.shortName.match(/\((.+)\)$/)?.[1] ?? null,
        longNameTh: r.longNameTh,
        longNameEn: r.longNameEn,
        descTh: r.descTh,
        mode,
        color: normColor(r.color, mode === 'bus' ? '#1D4ED8' : '#475569'),
        hubs: [...(routeHubs.get(id) ?? [])],
      };
    })
    .sort((a, b) => (a.mode === 'bus') - (b.mode === 'bus') || a.shortName.localeCompare(b.shortName, 'th', { numeric: true }));

  const usedAgencyIds = new Set(outRoutes.map((r) => r.agencyId));
  const sameName = new Map();
  for (const r of outRoutes) pushTo(sameName, `${r.agencyId} ${r.shortName} ${r.longNameTh}`, r.id);
  for (const [name, ids] of sameName) {
    if (ids.length > 1) warnings.push(`สายชื่อซ้ำ ${name}: route_id ${ids.join(', ')}`);
  }
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }).replaceAll('-', '');
  if (feed.feed_end_date && today > feed.feed_end_date) {
    warnings.push(`ข้อมูลหมดอายุแล้ว (ใช้ได้ถึง ${feed.feed_end_date}) ควรโหลดชุดใหม่จาก Namtang`);
  }

  const out = {
    schema: 'busbuddy-namtang/1',
    source: {
      publisherTh: clean(feed.feed_publisher_name) || 'สำนักงานนโยบายและแผนการขนส่งและจราจร กระทรวงคมนาคม',
      publisherUrl: clean(feed.feed_publisher_url),
      license: 'CC BY 4.0',
      feedVersion: clean(feed.feed_version),
      feedStartDate: clean(feed.feed_start_date),
      feedEndDate: clean(feed.feed_end_date),
      generatedAt: new Date().toISOString(),
    },
    hubs: CONFIG.hubs,
    agencies: [...usedAgencyIds].map((id) => agencies.get(id) ?? { id, nameTh: id, nameEn: id }),
    routes: outRoutes,
    variants,
    stops: [...usedStops].map((id) => {
      const s = stops.get(id);
      return { id, nameTh: s.nameTh, nameEn: s.nameEn, lat: round(s.lat, 6), lon: round(s.lon, 6), zone: s.zone, wheelchair: s.wheelchair };
    }),
    shapes,
    services,
    fares,
  };

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(out));
  const sizeMb = (fs.statSync(OUT_FILE).size / 1024 / 1024).toFixed(2);

  // 10. Report
  const hubName = Object.fromEntries(CONFIG.hubs.map((h) => [h.id, h.nameTh]));
  const busRoutes = outRoutes.filter((r) => r.mode === 'bus');
  const busByAgency = new Map();
  for (const r of busRoutes) busByAgency.set(r.agencyId, (busByAgency.get(r.agencyId) ?? 0) + 1);
  const railInFeed = new Map();
  for (const r of routes.values()) {
    if (CONFIG.railRouteTypes.includes(r.routeType)) railInFeed.set(r.agencyId, (railInFeed.get(r.agencyId) ?? 0) + 1);
  }
  const variantCount = new Map();
  for (const v of variants) variantCount.set(v.routeId, (variantCount.get(v.routeId) ?? 0) + 1);
  const fareText = (id) => {
    const f = fares[id];
    if (!f) return '-';
    const range = f.min === f.max ? `${f.min} บาท` : `${f.min}–${f.max} บาท`;
    return f.pairs ? `${range} (ตามโซน ${f.pairs.length} คู่)` : range;
  };


  const report = [
    '# รายงานการนำเข้าข้อมูล Namtang',
    '',
    '## สรุป',
    `- เวอร์ชันข้อมูล: ${out.source.feedVersion || '-'} (ใช้ได้ ${out.source.feedStartDate || '?'} ถึง ${out.source.feedEndDate || '?'})`,
    `- สาย: รถเมล์ ${busRoutes.length} สาย, รถไฟฟ้า ${outRoutes.length - busRoutes.length} สาย`,
    `- เที่ยวย่อย: ${variants.length} (เที่ยวสั้น ${variants.filter((v) => v.isShortTurn).length})`,
    `- ป้าย: ${out.stops.length}`,
    `- จุดของเส้นทาง: ${rawPts.toLocaleString()} -> ${keptPts.toLocaleString()}`,
    `- ขนาดไฟล์: ${sizeMb} MB`,
    '',
    '## คำเตือน',
    ...(warnings.length ? warnings.map((w) => `- ${w}`) : ['- ไม่มี']),
    '',
    '## ผู้ให้บริการของรถเมล์ที่เลือก',
    '| agency_id | ชื่อ | จำนวนสาย |',
    '|---|---|---|',
    ...[...busByAgency].sort((a, b) => b[1] - a[1]).map(([id, n]) => `| ${id} | ${safeCell(agencies.get(id)?.nameTh ?? '')} | ${n} |`),
    '',
    '## ผู้ให้บริการระบบราง (ทั้งไฟล์ ใช้เลือก railAgencies)',
    '| agency_id | ชื่อ | จำนวนสาย |',
    '|---|---|---|',
    ...[...railInFeed].map(([id, n]) => `| ${id} | ${safeCell(agencies.get(id)?.nameTh ?? '')} | ${n} |`),
    '',
    '## สายที่นำเข้า',
    '| route_id | agency | สาย | ชื่อ | ประเภท | ผ่านย่าน | เที่ยวย่อย | ค่าโดยสาร |',
    '|---|---|---|---|---|---|---|---|',
    ...outRoutes.map(
      (r) =>
        `| ${r.id} | ${r.agencyId} | ${safeCell(r.shortName)}${r.legacyName ? ` (${safeCell(r.legacyName)})` : ''} | ${safeCell(r.longNameTh)} | ${r.mode} | ${
          r.hubs.map((h) => hubName[h]).join(', ') || '-'
        } | ${variantCount.get(r.id) ?? 0} | ${fareText(r.id)} |`,
    ),
    '',
  ].join('\n');
  fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
  fs.writeFileSync(REPORT_FILE, report);

  log('done');
  console.log(`  routes : ${busRoutes.length} bus + ${outRoutes.length - busRoutes.length} rail`);
  console.log(`  output : ${path.relative(process.cwd(), OUT_FILE)} (${sizeMb} MB)`);
  console.log(`  report : ${path.relative(process.cwd(), REPORT_FILE)}`);
  if (warnings.length) console.log(`  warnings: ${warnings.length} (see report)`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});