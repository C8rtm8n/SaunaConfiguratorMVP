import type { Catalog } from '../model/catalog.js';
import type { ExteriorWallId, Opening, SaunaConfig, WallId, Zone } from '../model/config.js';
import { CONFIG_SCHEMA_VERSION } from '../model/config.js';
import type { Mm } from '../model/units.js';
import { createCatalogIndex } from '../catalog/index.js';
import { moduleGeometry } from '../geometry/module.js';
import { buildSlots } from '../geometry/slots.js';
import { roomWallFace } from '../geometry/walls.js';

/**
 * Pure editing operations used by the wizard (and later by the API to repair
 * stored configs). They keep a config *structurally* consistent with the catalog
 * (existing walls, slot ranges, zone coverage); domain rules still run in evaluate().
 */

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const snap = (v: number, step: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round((v - min) / step) * step + min));

export const ZONE_IDS = { sauna: 'z-sauna', changing: 'z-changing' } as const;

/** Valid starting configuration (custom frame, one sauna zone). */
export function defaultConfig(catalog: Catalog, id = 'new'): SaunaConfig {
  const mo = catalog.modules.custom_frame;
  const pick = <T extends { active: boolean; sku: string }>(xs: T[], pred: (x: T) => boolean = () => true) => xs.find((x) => x.active && pred(x))?.sku ?? '';
  const L = Math.min(mo.length_mm.max, Math.max(mo.length_mm.min, 4200));
  const base: SaunaConfig = {
    id,
    revision: 0,
    tenantId: catalog.tenantId,
    catalogVersion: catalog.version,
    schemaVersion: CONFIG_SCHEMA_VERSION,
    productLine: 'sauna',
    module: { type: 'custom_frame', L_mm: L, W_mm: mo.widths_mm[0]!, H_mm: mo.height_mm, grid_mm: mo.grids_mm[0]! },
    cladding: {
      exterior: pick(catalog.panels, (p) => p.role === 'exterior_cladding'),
      orientation: 'vertical',
      roof: pick(catalog.panels, (p) => p.role === 'roof_covering'),
    },
    openings: [],
    zones: [{ id: ZONE_IDS.sauna, type: 'sauna', from_mm: 0, to_mm: L }],
    sauna: {
      zoneId: ZONE_IDS.sauna,
      heater: { sku: pick(catalog.heaters, (h) => h.fuel === 'wood'), wall: 'W', along_mm: 0 },
      benches: { system: pick(catalog.benchSystems), layout: 'straight', levels: 2, wall: 'E' },
      lighting: [],
      interiorCladding: pick(catalog.panels, (p) => p.role === 'interior_cladding'),
    },
    attachments: [],
    foundation: 'pads',
  };
  const door = catalog.openings.find((o) => o.active && o.type === 'door' && o.moduleTypes.includes('custom_frame'));
  let c = normalizeConfig(base, catalog);
  if (door) {
    // Door in the middle of the front wall: between the heater (W) and the bench (E).
    const r = addOpening(c, catalog, 'S', Math.floor(L / c.module.grid_mm / 2), door.sku);
    if (r.config) c = r.config;
  }
  const light = catalog.purchased.find((p) => p.active && p.category === 'light');
  if (light) c.sauna.lighting = [{ sku: light.sku, mount: 'under_bench', qty: 1 }];
  // Heater centred on its wall.
  c.sauna.heater.along_mm = Number.NaN;
  return normalizeConfig(c, catalog);
}

/** Structural repair after any edit (D-037). Returns a new object. */
export function normalizeConfig(input: SaunaConfig, catalog: Catalog): SaunaConfig {
  const c = clone(input);
  const idx = createCatalogIndex(catalog);
  c.catalogVersion = catalog.version;
  c.tenantId = catalog.tenantId;

  // 1) Module.
  if (c.module.type === 'iso_20hc') {
    const cont = idx.get('container', catalog.modules.iso_20hc.container);
    c.module = { type: 'iso_20hc', L_mm: cont.L_mm, W_mm: cont.W_mm, H_mm: cont.H_mm, grid_mm: pickGrid(c.module.grid_mm, catalog.modules.iso_20hc.grids_mm) };
  } else {
    const mo = catalog.modules.custom_frame;
    const W = mo.widths_mm.reduce((a, b) => (Math.abs(b - c.module.W_mm) < Math.abs(a - c.module.W_mm) ? b : a));
    c.module = {
      type: 'custom_frame',
      L_mm: snap(c.module.L_mm, mo.length_mm.step, mo.length_mm.min, mo.length_mm.max),
      W_mm: W,
      H_mm: mo.height_mm,
      grid_mm: pickGrid(c.module.grid_mm, mo.grids_mm),
    };
  }
  const L = c.module.L_mm;
  const grid = c.module.grid_mm;

  // 2) Zones: 1 or 2, contiguous, partition on the grid.
  let zones: Zone[] = c.zones.filter((z) => z.type === 'sauna' || z.type === 'changing').slice(0, 2);
  if (!zones.some((z) => z.type === 'sauna')) zones = [{ id: ZONE_IDS.sauna, type: 'sauna', from_mm: 0, to_mm: L }];
  if (zones.length === 2 && zones[0]!.type === zones[1]!.type) zones = [zones[0]!];
  if (zones.length === 1) {
    zones = [{ ...zones[0]!, type: 'sauna', id: ZONE_IDS.sauna, from_mm: 0, to_mm: L }];
  } else {
    const x = snap(zones[0]!.to_mm, grid, grid, Math.floor((L - 1) / grid) * grid);
    zones = [
      { ...zones[0]!, id: ZONE_IDS[zones[0]!.type], from_mm: 0, to_mm: x },
      { ...zones[1]!, id: ZONE_IDS[zones[1]!.type], from_mm: x, to_mm: L },
    ];
  }
  c.zones = zones;
  c.sauna.zoneId = zones.find((z) => z.type === 'sauna')!.id;

  // 3) Openings vs. slots of the (new) geometry.
  const geo = moduleGeometry(c, idx);
  const slots = buildSlots({ ...c, openings: [] }, idx, geo);
  const taken = new Set<string>();
  const kept: Opening[] = [];
  for (const o of c.openings) {
    const pr = idx.find('opening', o.sku);
    const lay = slots[o.wall];
    if (!pr || !lay || !pr.moduleTypes.includes(c.module.type) || pr.type !== o.type) continue;
    const n = pr.fullWall ? lay.slots.length : pr.slots[grid];
    if (!n || n > lay.slots.length) continue;
    const want = pr.fullWall ? 0 : Math.min(Math.max(0, o.slotFrom), lay.slots.length - n);
    // Nearest start that is free and (on long walls) does not cross a partition.
    const crosses = (f: number) => {
      if (o.wall !== 'S' && o.wall !== 'N') return false;
      const mid = (lay.slots[f]!.from_mm + lay.slots[f + n - 1]!.to_mm) / 2;
      const [a, b] = [mid - pr.width_mm / 2, mid + pr.width_mm / 2];
      return geo.partitions.some((p) => a < p.x_mm + p.thickness_mm / 2 && b > p.x_mm - p.thickness_mm / 2);
    };
    const keysOf = (f: number) => Array.from({ length: n }, (_, i) => `${o.wall}:${f + i}`);
    const starts = Array.from({ length: lay.slots.length - n + 1 }, (_, i) => i).sort((x, y) => Math.abs(x - want) - Math.abs(y - want) || x - y);
    const from = (pr.fullWall ? [0] : starts).find((f) => !crosses(f) && !keysOf(f).some((k) => taken.has(k)));
    if (from === undefined) continue;
    keysOf(from).forEach((k) => taken.add(k));
    const fixed: Opening = { ...o, slotFrom: from, slotTo: from + n - 1 };
    if (pr.type === 'door' && !fixed.door) fixed.door = { hinge: 'left', swing: 'out' };
    if (pr.type !== 'door') delete fixed.door;
    kept.push(fixed);
  }
  c.openings = kept;

  // 4) Sauna interior: walls must bound the sauna room, heater inside its wall.
  const room = geo.rooms.find((r) => r.zoneId === c.sauna.zoneId)!;
  const roomWalls: WallId[] = [room.walls.S, room.walls.N, room.walls.west, room.walls.east];
  if (!roomWalls.includes(c.sauna.heater.wall)) c.sauna.heater.wall = room.walls.west;
  const heater = idx.find('heater', c.sauna.heater.sku) ?? catalog.heaters.find((h) => h.active);
  if (heater) {
    c.sauna.heater.sku = heater.sku;
    const face = roomWallFace(room.box, room.walls, c.sauna.heater.wall)!;
    const lo = face.along[0] + heater.size.w_mm / 2;
    const hi = face.along[1] - heater.size.w_mm / 2;
    const a = c.sauna.heater.along_mm;
    c.sauna.heater.along_mm = Number.isFinite(a) ? Math.round(Math.min(hi, Math.max(lo, a))) : Math.round((lo + hi) / 2);
  }
  const b = c.sauna.benches;
  if (!roomWalls.includes(b.wall)) b.wall = room.walls.east;
  if (b.layout === 'L') {
    const mf = roomWallFace(room.box, room.walls, b.wall)!;
    const rf = b.returnWall && roomWalls.includes(b.returnWall) ? roomWallFace(room.box, room.walls, b.returnWall) : undefined;
    if (!rf || rf.axis === mf.axis) b.returnWall = mf.axis === 0 ? room.walls.east : room.walls.N;
  } else delete b.returnWall;
  if (b.from_mm !== undefined && b.to_mm !== undefined && b.to_mm <= b.from_mm) {
    delete b.from_mm;
    delete b.to_mm;
  }

  // 5) Attachments: drop dangling references and out-of-range slots.
  const terraces = new Set(c.attachments.filter((a) => a.type === 'terrace' && idx.find('attachment_system', a.sku)).map((a) => a.id));
  c.attachments = c.attachments.filter((a) => {
    if (!idx.find('attachment_system', a.sku)) return false;
    if (a.type === 'terrace' && a.slotFrom !== undefined && a.slotTo !== undefined) {
      const lay = slots[a.wall]!;
      if (a.slotTo >= lay.slots.length) {
        delete a.slotFrom;
        delete a.slotTo;
      }
    }
    if (a.type === 'railing') return terraces.has(a.attachTo);
    if (a.type === 'stairs') return terraces.has(a.attachTo) || ['N', 'S', 'E', 'W'].includes(a.attachTo);
    return true;
  });
  return c;
}

function pickGrid(g: number, allowed: readonly (600 | 1200)[]): 600 | 1200 {
  return allowed.includes(g as 600 | 1200) ? (g as 600 | 1200) : allowed[0]!;
}

export type AddOpeningResult = { config: SaunaConfig; openingId: string; error?: undefined } | { config?: undefined; openingId?: undefined; error: 'unknown_product' | 'no_wall' | 'too_wide' | 'occupied' };

/** Places a product so that it covers `slot` (shifted left if it would overflow the wall). */
export function addOpening(c: SaunaConfig, catalog: Catalog, wall: WallId, slot: number, sku: string): AddOpeningResult {
  const idx = createCatalogIndex(catalog);
  const pr = idx.find('opening', sku);
  if (!pr || !pr.moduleTypes.includes(c.module.type)) return { error: 'unknown_product' };
  const geo = moduleGeometry(c, idx);
  const lay = buildSlots({ ...c, openings: [] }, idx, geo)[wall];
  if (!lay) return { error: 'no_wall' };
  const n = pr.fullWall ? lay.slots.length : pr.slots[c.module.grid_mm];
  if (!n || n > lay.slots.length) return { error: 'too_wide' };
  const from = pr.fullWall ? 0 : Math.min(Math.max(0, slot), lay.slots.length - n);
  const busy = c.openings.some((o) => o.wall === wall && o.slotFrom <= from + n - 1 && o.slotTo >= from);
  if (busy) return { error: 'occupied' };
  let k = c.openings.length + 1;
  while (c.openings.some((o) => o.id === `o${k}`)) k++;
  const o: Opening = { id: `o${k}`, wall, slotFrom: from, slotTo: from + n - 1, type: pr.type, sku };
  if (pr.type === 'door') o.door = { hinge: 'left', swing: 'out' };
  const next = clone(c);
  next.openings.push(o);
  return { config: normalizeConfig(next, catalog), openingId: o.id };
}

export function removeOpening(c: SaunaConfig, id: string): SaunaConfig {
  const next = clone(c);
  next.openings = next.openings.filter((o) => o.id !== id);
  return next;
}

/** 1 or 2 zones; `saunaFirst` = sauna at the W end; `partition_mm` = boundary (snapped). */
export function setLayout(c: SaunaConfig, catalog: Catalog, count: 1 | 2, saunaFirst = true, partition_mm?: Mm): SaunaConfig {
  const next = clone(c);
  const L = next.module.L_mm;
  if (count === 1) next.zones = [{ id: ZONE_IDS.sauna, type: 'sauna', from_mm: 0, to_mm: L }];
  else {
    const minSauna = catalog.limits.zoneMinLength_mm['sauna']?.value ?? 0;
    const x = partition_mm ?? (saunaFirst ? Math.max(minSauna, L * 0.6) : L - Math.max(minSauna, L * 0.6));
    const [a, b] = saunaFirst ? (['sauna', 'changing'] as const) : (['changing', 'sauna'] as const);
    next.zones = [
      { id: ZONE_IDS[a], type: a, from_mm: 0, to_mm: x },
      { id: ZONE_IDS[b], type: b, from_mm: x, to_mm: L },
    ];
  }
  return normalizeConfig(next, catalog);
}

/** Terrace presets for the wizard: none / front (E end) / side (S wall). */
export function setTerrace(c: SaunaConfig, catalog: Catalog, kind: 'none' | 'front' | 'side', opts: { depth_mm?: Mm; railing?: boolean; stairs?: boolean } = {}): SaunaConfig {
  const next = clone(c);
  next.attachments = next.attachments.filter((a) => a.type === 'roof_overhang');
  if (kind === 'none') return normalizeConfig(next, catalog);
  const sys = catalog.attachmentSystems.find((a) => a.active && a.type === 'terrace');
  if (!sys) return normalizeConfig(next, catalog);
  const wall: ExteriorWallId = kind === 'front' ? 'E' : 'S';
  const depth = opts.depth_mm && sys.allowedDepths_mm?.includes(opts.depth_mm) ? opts.depth_mm : (sys.allowedDepths_mm?.[1] ?? sys.allowedDepths_mm?.[0] ?? 1200);
  next.attachments.push({ id: 'terrace', type: 'terrace', wall, depth_mm: depth, sku: sys.sku });
  const sides: ExteriorWallId[] = wall === 'E' ? ['N', 'S'] : ['W', 'E'];
  const rail = catalog.attachmentSystems.find((a) => a.active && a.type === 'railing');
  if (opts.railing && rail) next.attachments.push({ id: 'railing', type: 'railing', attachTo: 'terrace', edges: [...sides, wall], sku: rail.sku });
  const stairs = catalog.attachmentSystems.find((a) => a.active && a.type === 'stairs');
  if (opts.stairs && stairs) next.attachments.push({ id: 'stairs', type: 'stairs', attachTo: 'terrace', edge: wall, slot: 1, sku: stairs.sku });
  return normalizeConfig(next, catalog);
}

export function setOverhang(c: SaunaConfig, catalog: Catalog, wall: ExteriorWallId | null, depth_mm?: Mm): SaunaConfig {
  const next = clone(c);
  next.attachments = next.attachments.filter((a) => a.type !== 'roof_overhang');
  const sys = catalog.attachmentSystems.find((a) => a.active && a.type === 'roof_overhang');
  if (wall && sys) next.attachments.push({ id: 'overhang', type: 'roof_overhang', wall, depth_mm: depth_mm ?? sys.allowedDepths_mm?.[0] ?? 600, sku: sys.sku });
  return normalizeConfig(next, catalog);
}
