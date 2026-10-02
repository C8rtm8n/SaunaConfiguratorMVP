import type { BuildContext } from '../../model/component.js';
import type { AutoFn, CheckFn, FixFn } from '../../model/productLine.js';
import type { ConfigPatchOp, Finding } from '../../model/rules.js';
import type { Mm, Vec3 } from '../../model/units.js';
import { roomWallFace } from '../../geometry/walls.js';
import { boxesOverlap, round } from '../../util/math.js';
import { type Face, faceBox, heaterBoxes, type SaunaLayout, saunaLayout } from './layout.js';

const EPS = 1e-6;

// ------------------------------------------------------------ helpers ---

/** All R02 collisions of a heater envelope placed at `along` on `face`. */
export function heaterCollisions(ctx: BuildContext, l: SaunaLayout, face: Face, along: Mm): Finding[] {
  const heater = l.heater?.item ?? ctx.catalog.get('heater', ctx.config.sauna.heater.sku);
  const { envelope } = heaterBoxes(face, heater, along, l.floor_mm);
  const out: Finding[] = [];
  const rb = l.room.box;
  const sides: Array<[string, boolean]> = [
    [l.room.walls.west, envelope.min[0] < rb.min[0] - EPS],
    [l.room.walls.east, envelope.max[0] > rb.max[0] + EPS],
    [l.room.walls.S, envelope.min[1] < rb.min[1] - EPS],
    [l.room.walls.N, envelope.max[1] > rb.max[1] + EPS],
  ];
  for (const [w, hit] of sides) if (hit) out.push({ variant: 'wall', params: { wall: w }, affectedIds: ['heater'] });
  if (envelope.max[2] > l.ceiling_mm + EPS) {
    out.push({
      variant: 'ceiling',
      params: { gap_mm: round(l.ceiling_mm - l.floor_mm - heater.size.h_mm, 0), required_mm: heater.clearance.top_mm },
      affectedIds: ['heater'],
    });
  }
  for (const s of l.bench?.segs ?? []) {
    if (boxesOverlap(envelope, s.box)) {
      out.push({ variant: 'bench', params: { bench: s.id }, affectedIds: ['heater', 'benches'] });
      break;
    }
  }
  for (const p of l.roomOpenings) {
    const f = roomWallFace(l.room.box, l.room.walls, p.opening.wall);
    if (!f) continue;
    if (p.product.type === 'door') {
      const passage = faceBox(f, p.along, [0, ctx.catalog.catalog.limits.doorClearDepth_mm.value], p.z);
      if (boxesOverlap(envelope, passage)) out.push({ variant: 'door', params: { opening: p.opening.id }, affectedIds: ['heater', p.opening.id] });
    } else if (p.product.glassArea_m2 > 0) {
      const glass = faceBox(f, p.along, [0, 1], p.z);
      if (boxesOverlap(envelope, glass)) out.push({ variant: 'glass', params: { opening: p.opening.id }, affectedIds: ['heater', p.opening.id] });
    }
  }
  return out;
}

// ------------------------------------------------------------- checks ---

/** S10: sauna zone, heater and bench placement are resolvable. */
const saunaPlacement: CheckFn = (ctx) => {
  const s = ctx.config.sauna;
  const zone = ctx.config.zones.find((z) => z.id === s.zoneId);
  if (!zone || zone.type !== 'sauna') return [{ variant: 'zone', params: { zone: s.zoneId }, affectedIds: [s.zoneId] }];
  const l = saunaLayout(ctx);
  if (!l) return [];
  const out: Finding[] = [];
  const heater = ctx.catalog.find('heater', s.heater.sku);
  if (!heater) out.push({ variant: 'heaterSku', params: { sku: s.heater.sku }, affectedIds: ['heater'] });
  const face = roomWallFace(l.room.box, l.room.walls, s.heater.wall);
  if (!face) out.push({ variant: 'heaterWall', params: { wall: s.heater.wall }, affectedIds: ['heater'] });
  else if (l.heater && (l.heater.box.min[face.axis] < face.along[0] - EPS || l.heater.box.max[face.axis] > face.along[1] + EPS)) {
    out.push({ variant: 'heaterAlong', params: { along_mm: s.heater.along_mm }, affectedIds: ['heater'] });
  }
  if (!ctx.catalog.find('bench_system', s.benches.system)) out.push({ variant: 'benchSku', params: { sku: s.benches.system }, affectedIds: ['benches'] });
  const bf = roomWallFace(l.room.box, l.room.walls, s.benches.wall);
  if (!bf) out.push({ variant: 'benchWall', params: { wall: s.benches.wall }, affectedIds: ['benches'] });
  if (s.benches.layout === 'L') {
    const rf = s.benches.returnWall ? roomWallFace(l.room.box, l.room.walls, s.benches.returnWall) : undefined;
    if (!rf || (bf && rf.axis === bf.axis)) out.push({ variant: 'returnWall', params: { wall: s.benches.returnWall ?? null }, affectedIds: ['benches'] });
  }
  return out;
};

/** R02: heater clearance envelope vs walls, ceiling, benches, glass, doors. */
const heaterClearance: CheckFn = (ctx) => {
  const l = saunaLayout(ctx);
  if (!l?.heater) return [];
  return heaterCollisions(ctx, l, l.heater.face, l.heater.centreAlong);
};

/** R04: sauna door – exists, clear width, swings out, free passage. */
const saunaDoor: CheckFn = (ctx) => {
  const l = saunaLayout(ctx);
  if (!l) return [];
  if (l.doors.length === 0) return [{ variant: 'missing', params: {}, affectedIds: [l.zone.id] }];
  const lim = ctx.catalog.catalog.limits;
  const out: Finding[] = [];
  for (const d of l.doors) {
    const o = d.placed.opening;
    const idx = ctx.config.openings.indexOf(o);
    const cw = d.placed.product.clearWidth_mm ?? d.placed.product.width_mm;
    if (cw < lim.doorMinClearWidth_mm.value) out.push({ variant: 'width', params: { opening: o.id, clearWidth_mm: cw, min_mm: lim.doorMinClearWidth_mm.value }, affectedIds: [o.id] });
    if (o.door?.swing !== 'out') {
      const patch: ConfigPatchOp[] = o.door
        ? [{ op: 'replace', path: `/openings/${idx}/door/swing`, value: 'out' }]
        : [{ op: 'add', path: `/openings/${idx}/door`, value: { hinge: 'left', swing: 'out' } }];
      out.push({ variant: 'swing', params: { opening: o.id }, affectedIds: [o.id], patch });
    }
    const bench = l.bench?.segs.find((s) => boxesOverlap(d.passage, s.box));
    if (bench) out.push({ variant: 'bench', params: { opening: o.id, bench: bench.id }, affectedIds: [o.id, 'benches'] });
    if (l.heater && boxesOverlap(d.passage, l.heater.box)) out.push({ variant: 'heater', params: { opening: o.id }, affectedIds: [o.id, 'heater'] });
  }
  return out;
};

/** R05b: flue clearance to combustible walls and to the roof edge / overhang. */
const flueClearance: CheckFn = (ctx) => {
  const l = saunaLayout(ctx);
  const f = l?.heater?.flue;
  const spec = l?.heater?.item.flue;
  if (!l || !f || !spec) return [];
  const interior = ctx.catalog.get('panel', ctx.config.sauna.interiorCladding);
  const need = f.r + (interior.combustible ? spec.clearanceCombustible_mm : 0);
  const b = l.room.box;
  const d = Math.min(f.x - b.min[0], b.max[0] - f.x, f.y - b.min[1], b.max[1] - f.y);
  const out: Finding[] = [];
  if (d < need - EPS) out.push({ variant: 'wall', params: { distance_mm: round(d - f.r, 0), required_mm: need - f.r }, affectedIds: ['heater'] });
  const e = ctx.geo.envelope;
  const edge = Math.min(f.x - e.min[0], e.max[0] - f.x, f.y - e.min[1], e.max[1] - f.y) - f.r;
  const minEdge = ctx.catalog.catalog.limits.flueMinRoofEdgeDistance_mm.value;
  if (edge < minEdge - EPS) out.push({ variant: 'edge', params: { distance_mm: round(edge, 0), required_mm: minEdge }, affectedIds: ['heater'] });
  if (f.roofSlot === undefined) out.push({ variant: 'slot', params: {}, affectedIds: ['heater'] });
  return out;
};

/** R08: minimum zone lengths; fix moves the partition within the grid. */
const zoneLengths: CheckFn = (ctx) => {
  const lim = ctx.catalog.catalog.limits.zoneMinLength_mm;
  const zones = ctx.config.zones;
  const grid = ctx.config.module.grid_mm;
  const out: Finding[] = [];
  zones.forEach((z, k) => {
    const min = lim[z.type]?.value;
    const len = z.to_mm - z.from_mm;
    if (min === undefined || len >= min) return;
    const deficit = Math.ceil((min - len) / grid) * grid;
    let patch: ConfigPatchOp[] | undefined;
    const tryShift = (nk: number, newBoundary: Mm, pathFrom: string, pathTo: string) => {
      const n = zones[nk];
      if (!n) return;
      const nMin = lim[n.type]?.value ?? 0;
      const nLen = nk > k ? n.to_mm - newBoundary : newBoundary - n.from_mm;
      if (nLen >= nMin) patch = [{ op: 'replace', path: pathTo, value: newBoundary }, { op: 'replace', path: pathFrom, value: newBoundary }];
    };
    if (k < zones.length - 1) tryShift(k + 1, z.to_mm + deficit, `/zones/${k + 1}/from_mm`, `/zones/${k}/to_mm`);
    if (!patch && k > 0) tryShift(k - 1, z.from_mm - deficit, `/zones/${k}/from_mm`, `/zones/${k - 1}/to_mm`);
    const f: Finding = { params: { zone: z.id, type: z.type, length_mm: len, min_mm: min }, affectedIds: [z.id] };
    if (patch) f.patch = patch;
    out.push(f);
  });
  return out;
};

export const SAUNA_CHECKS: Record<string, CheckFn> = { saunaPlacement, heaterClearance, saunaDoor, flueClearance, zoneLengths };

// -------------------------------------------------------------- autos ---

/** R05: chimney through a roof slot above a wood-burning heater. */
const chimney: AutoFn = (ctx) => {
  const h = saunaLayout(ctx)?.heater;
  if (!h?.flue || !h.item.flue) return [];
  return [
    {
      components: [{ id: 'chimney', builder: 'sauna.chimney', params: {} }],
      note: { cs: 'Aktivován střešní slot {slot} pro kouřovod Ø{diameter_mm} a přidána komínová sestava.', de: 'Dachslot {slot} für Rauchrohr Ø{diameter_mm} aktiviert, Kaminset hinzugefügt.', en: 'Roof slot {slot} activated for flue Ø{diameter_mm}; chimney set added.' },
      params: { slot: h.flue.roofSlot ?? null, diameter_mm: h.item.flue.diameter_mm, x_mm: round(h.flue.x, 0), y_mm: round(h.flue.y, 0) },
    },
  ];
};

/** R06: supply grille at/below the heater, exhaust diagonally opposite under the ceiling. */
const ventilation: AutoFn = (ctx) => {
  const l = saunaLayout(ctx);
  if (!l?.heater) return [];
  const v = ctx.catalog.catalog.limits.ventilation;
  const hf = l.heater.face;
  const w = l.room.walls;
  const hw = ctx.config.sauna.heater.wall;
  const opp = hw === w.S ? w.N : hw === w.N ? w.S : hw === w.west ? w.east : w.west;
  const of = roomWallFace(l.room.box, w, opp)!;
  const pt = (face: Face, along: Mm, z: Mm): Vec3 => {
    const p: [number, number, number] = [0, 0, z];
    p[face.axis] = along;
    p[face.normalAxis] = face.plane;
    return p;
  };
  const supply = pt(hf, l.heater.centreAlong, l.floor_mm + v.supplyHeight_mm.value);
  // Along the opposite wall: far from the heater (same axis for opposite walls).
  const mid = (of.along[0] + of.along[1]) / 2;
  const off = v.exhaustCornerOffset_mm.value;
  const heaterSide = l.heater.centreAlong < (hf.along[0] + hf.along[1]) / 2;
  const exAlong = heaterSide ? of.along[1] - off : of.along[0] + off;
  const exhaust = pt(of, Number.isFinite(exAlong) ? exAlong : mid, l.ceiling_mm - v.exhaustBelowCeiling_mm.value);
  return [
    {
      components: [{ id: 'ventilation', builder: 'sauna.ventilation', params: { supply, exhaust, supplyWall: hw, exhaustWall: opp } }],
      note: { cs: 'Větrání: přívod na stěně {supplyWall} u kamen, odvod diagonálně na stěně {exhaustWall} pod stropem.', de: 'Lüftung: Zuluft an Wand {supplyWall} beim Ofen, Abluft diagonal an Wand {exhaustWall} unter der Decke.', en: 'Ventilation: supply on wall {supplyWall} at the heater, exhaust diagonally on wall {exhaustWall} below the ceiling.' },
      params: { supplyWall: hw, exhaustWall: opp },
    },
  ];
};

/** R09: intermediate bench supports where the span exceeds the system limit. */
const benchSupports: AutoFn = (ctx) => {
  const bench = saunaLayout(ctx)?.bench;
  if (!bench) return [];
  const max = bench.system.maxSpan_mm;
  const out = [];
  for (const s of bench.segs) {
    const len = s.along[1] - s.along[0];
    if (len <= max) continue;
    const count = Math.ceil(len / max) - 1;
    out.push({
      components: [{ id: `bench-supports-${s.id}`, builder: 'sauna.benchSupports', params: { segId: s.id, count } }],
      note: { cs: 'Lavice {bench}: rozpětí {span_mm} mm > {max_mm} mm, doplněno {count} podpěr.', de: 'Bank {bench}: Spannweite {span_mm} mm > {max_mm} mm, {count} Stützen ergänzt.', en: 'Bench {bench}: span {span_mm} mm > {max_mm} mm, {count} supports added.' },
      params: { bench: s.id, span_mm: round(len, 0), max_mm: max, count },
    });
  }
  return out;
};

/** R10: electrical sizing for electric heaters (informative). */
export function electricalFor(ctx: BuildContext): { power_kw: number; voltage: 230 | 400; breaker_A: number; cable: string } | undefined {
  const h = ctx.catalog.find('heater', ctx.config.sauna.heater.sku);
  if (!h || h.fuel !== 'electric' || !h.electrical) return undefined;
  const v = h.electrical.voltage;
  const row = [...ctx.catalog.catalog.electrical].filter((r) => r.voltage === v && r.maxPower_kw >= h.power_kw).sort((a, b) => a.maxPower_kw - b.maxPower_kw)[0];
  if (!row) return undefined;
  return { power_kw: h.power_kw, voltage: v, breaker_A: row.breaker_A, cable: row.cable };
}

const electrical: AutoFn = (ctx) => {
  const e = electricalFor(ctx);
  if (!e) return [];
  return [
    {
      components: [],
      note: { cs: 'Přípojka kamen: {power_kw} kW / {voltage} V, jistič {breaker_A} A, kabel {cable} (orientačně, ověří elektroprojektant).', de: 'Anschluss: {power_kw} kW / {voltage} V, Sicherung {breaker_A} A, Kabel {cable} (Richtwert).', en: 'Heater supply: {power_kw} kW / {voltage} V, breaker {breaker_A} A, cable {cable} (indicative).' },
      params: { ...e },
    },
  ];
};

export const SAUNA_AUTOS: Record<string, AutoFn> = { chimney, ventilation, benchSupports, electrical };

// --------------------------------------------------------------- fixes ---

/** R01: closest suitable heater (same fuel first). */
const suitableHeaterFix: FixFn = (ctx, facts) => {
  const ev = facts['sauna.eqVolume_m3'];
  const clear = facts['sauna.clearHeight_mm'];
  if (typeof ev !== 'number') return null;
  const cur = ctx.catalog.find('heater', ctx.config.sauna.heater.sku);
  const ok = suitableHeaters(ctx, ev, typeof clear === 'number' ? clear : Infinity);
  const pick = ok.sort((a, b) => Number(b.fuel === cur?.fuel) - Number(a.fuel === cur?.fuel) || Math.abs(a.power_kw - (cur?.power_kw ?? 0)) - Math.abs(b.power_kw - (cur?.power_kw ?? 0)))[0];
  return pick ? [{ op: 'replace', path: '/sauna/heater/sku', value: pick.sku }] : null;
};

export function suitableHeaters(ctx: BuildContext, eq: number, clearHeight: number) {
  return ctx.catalog
    .all('heater')
    .filter((h) => h.active && eq >= h.volume_min_m3 && eq <= h.volume_max_m3 && h.minCabinHeight_mm <= clearHeight)
    .sort((a, b) => a.sku.localeCompare(b.sku));
}

/** R02: nearest collision-free heater position – same wall first, then the other sauna walls. */
const heaterPositionFix: FixFn = (ctx) => {
  const l = saunaLayout(ctx);
  if (!l?.heater) return null;
  const w = l.heater.item.size.w_mm;
  const cur = ctx.config.sauna.heater;
  const step = 50;
  const walls = [cur.wall, ...[l.room.walls.S, l.room.walls.N, l.room.walls.west, l.room.walls.east].filter((x) => x !== cur.wall)];
  for (const wall of walls) {
    const face = roomWallFace(l.room.box, l.room.walls, wall);
    if (!face) continue;
    const ref = wall === cur.wall ? cur.along_mm : (face.along[0] + face.along[1]) / 2;
    const cands: Mm[] = [];
    for (let a = face.along[0] + w / 2; a <= face.along[1] - w / 2 + EPS; a += step) cands.push(Math.round(a / step) * step);
    cands.sort((a, b) => Math.abs(a - ref) - Math.abs(b - ref) || a - b);
    const best = cands.find((a) => a - w / 2 >= face.along[0] - EPS && a + w / 2 <= face.along[1] + EPS && heaterCollisions(ctx, l, face, a).filter((f) => f.variant !== 'ceiling').length === 0);
    if (best === undefined || (wall === cur.wall && best === cur.along_mm)) continue;
    return wall === cur.wall
      ? [{ op: 'replace', path: '/sauna/heater/along_mm', value: best }]
      : [
          { op: 'replace', path: '/sauna/heater/wall', value: wall },
          { op: 'replace', path: '/sauna/heater/along_mm', value: best },
        ];
  }
  return null;
};

/** R04: move a blocked sauna door to the nearest free slot range on its wall. */
const doorPositionFix: FixFn = (ctx) => {
  const l = saunaLayout(ctx);
  if (!l) return null;
  const depth = ctx.catalog.catalog.limits.doorClearDepth_mm.value;
  const blocked = (passage: Parameters<typeof boxesOverlap>[0]) =>
    (l.bench?.segs ?? []).some((s) => boxesOverlap(passage, s.box)) || (!!l.heater && boxesOverlap(passage, l.heater.envelope));
  for (const d of l.doors) {
    if (!blocked(d.passage)) continue;
    const o = d.placed.opening;
    const lay = ctx.slots[o.wall];
    if (!lay) continue;
    const n = o.slotTo - o.slotFrom + 1;
    const others = ctx.config.openings.filter((x) => x.wall === o.wall && x.id !== o.id);
    const starts = Array.from({ length: lay.slots.length - n + 1 }, (_, i) => i).sort((a, b) => Math.abs(a - o.slotFrom) - Math.abs(b - o.slotFrom) || a - b);
    for (const f of starts) {
      if (f === o.slotFrom || others.some((x) => x.slotFrom <= f + n - 1 && x.slotTo >= f)) continue;
      const a = lay.slots[f]!;
      const b = lay.slots[f + n - 1]!;
      const mid = (a.from_mm + b.to_mm) / 2;
      const along: [Mm, Mm] = [mid - d.placed.product.width_mm / 2, mid + d.placed.product.width_mm / 2];
      if (along[0] < a.clearFrom_mm - EPS || along[1] > b.clearTo_mm + EPS) continue;
      if (along[0] < d.face.along[0] - EPS || along[1] > d.face.along[1] + EPS) continue; // stay in the sauna room
      if ((o.wall === 'S' || o.wall === 'N') && ctx.geo.partitions.some((p) => along[0] < p.x_mm + p.thickness_mm / 2 && along[1] > p.x_mm - p.thickness_mm / 2)) continue;
      if (blocked(faceBox(d.face, along, [0, depth], d.placed.z))) continue;
      const i = ctx.config.openings.indexOf(o);
      return [
        { op: 'replace', path: `/openings/${i}/slotFrom`, value: f },
        { op: 'replace', path: `/openings/${i}/slotTo`, value: f + n - 1 },
      ];
    }
    // No free position for the door: shorten the main bench so that it ends at the passage.
    const bench = l.bench;
    if (!bench || (l.heater && boxesOverlap(d.passage, l.heater.envelope))) continue;
    const main = bench.segs.filter((sg) => sg.leg === 'main');
    if (!main.length || bench.segs.some((sg) => sg.leg === 'return' && boxesOverlap(d.passage, sg.box))) continue;
    const ax = main[0]!.face.axis;
    const [b0, b1] = main[0]!.along;
    const [p0, p1] = [d.passage.min[ax], d.passage.max[ax]];
    const keepLow: [Mm, Mm] = [b0, Math.min(b1, p0)];
    const keepHigh: [Mm, Mm] = [Math.max(b0, p1), b1];
    const keep = keepLow[1] - keepLow[0] >= keepHigh[1] - keepHigh[0] ? keepLow : keepHigh;
    if (keep[1] - keep[0] < bench.system.maxSpan_mm / 2) continue;
    return [
      { op: 'add', path: '/sauna/benches/from_mm', value: Math.round(keep[0]) },
      { op: 'add', path: '/sauna/benches/to_mm', value: Math.round(keep[1]) },
    ];
  }
  return null;
};

export const SAUNA_FIXES: Record<string, FixFn> = { suitableHeater: suitableHeaterFix, heaterPosition: heaterPositionFix, doorPosition: doorPositionFix };

