import type { BenchSystem, Heater } from '../../model/catalog.js';
import type { Box3, BuildContext, Room } from '../../model/component.js';
import type { WallId, Zone } from '../../model/config.js';
import type { Mm } from '../../model/units.js';
import { placedOpenings, type PlacedOpening } from '../../geometry/openings.js';
import { roomWallFace } from '../../geometry/walls.js';

export type Face = NonNullable<ReturnType<typeof roomWallFace>>;

/** Box from ranges along the face, away from the face (depth from the face plane) and in z. */
export function faceBox(face: Face, along: [Mm, Mm], depth: [Mm, Mm], z: [Mm, Mm]): Box3 {
  const min: [number, number, number] = [0, 0, z[0]];
  const max: [number, number, number] = [0, 0, z[1]];
  min[face.axis] = along[0];
  max[face.axis] = along[1];
  const p = face.plane + face.inward * depth[0];
  const q = face.plane + face.inward * depth[1];
  min[face.normalAxis] = Math.min(p, q);
  max[face.normalAxis] = Math.max(p, q);
  return { min, max };
}

export interface BenchSeg {
  id: string;
  leg: 'main' | 'return';
  wall: WallId;
  level: number; // 0 = lowest used level
  top_mm: Mm; // above finished floor
  depth_mm: Mm;
  along: [Mm, Mm];
  depthRange: [Mm, Mm];
  face: Face;
  /** Solid volume floor → bench top (for collisions). */
  box: Box3;
  /** Bench top board box. */
  topBox: Box3;
}

export interface SaunaDoor {
  placed: PlacedOpening;
  face: Face;
  /** Free passage inside the sauna in front of the door. */
  passage: Box3;
}

export interface SaunaLayout {
  zone: Zone;
  room: Room;
  floor_mm: Mm;
  ceiling_mm: Mm;
  heater?: {
    item: Heater;
    face: Face;
    box: Box3;
    envelope: Box3;
    centreAlong: Mm;
    flue?: { x: Mm; y: Mm; r: Mm; roofSlot: number | undefined };
  };
  bench?: { system: BenchSystem; segs: BenchSeg[]; top_mm: Mm };
  doors: SaunaDoor[];
  roomOpenings: PlacedOpening[];
  volume_m3: number;
  glassArea_m2: number;
  uninsulatedArea_m2: number;
}

const cache = new WeakMap<BuildContext, SaunaLayout | undefined>();

/** Openings belonging to the room's walls (long walls: centre inside the room's x range). */
export function roomOpenings(ctx: BuildContext, room: Room): PlacedOpening[] {
  return placedOpenings(ctx).filter((p) => {
    const w = p.opening.wall;
    if (w === room.walls.west || w === room.walls.east) return true;
    if (w === 'S' || w === 'N') {
      const c = (p.along[0] + p.along[1]) / 2;
      return c > room.box.min[0] && c < room.box.max[0];
    }
    return false;
  });
}

export function saunaLayout(ctx: BuildContext): SaunaLayout | undefined {
  if (cache.has(ctx)) return cache.get(ctx);
  const res = compute(ctx);
  cache.set(ctx, res);
  return res;
}

function compute(ctx: BuildContext): SaunaLayout | undefined {
  const s = ctx.config.sauna;
  const zone = ctx.config.zones.find((z) => z.id === s.zoneId && z.type === 'sauna');
  const room = ctx.geo.rooms.find((r) => r.zoneId === s.zoneId);
  if (!zone || !room) return undefined;
  const b = room.box;
  const floor = b.min[2];
  const ceiling = b.max[2];
  const lim = ctx.catalog.catalog.limits;

  const layout: SaunaLayout = {
    zone,
    room,
    floor_mm: floor,
    ceiling_mm: ceiling,
    doors: [],
    roomOpenings: roomOpenings(ctx, room),
    volume_m3: ((b.max[0] - b.min[0]) * (b.max[1] - b.min[1]) * (b.max[2] - b.min[2])) / 1e9,
    glassArea_m2: 0,
    uninsulatedArea_m2: 0,
  };

  // Heater.
  const heater = ctx.catalog.find('heater', s.heater.sku);
  const hFace = roomWallFace(b, room.walls, s.heater.wall);
  if (heater && hFace) {
    const c = s.heater.along_mm;
    const cl = heater.clearance;
    const d = heater.size.d_mm;
    const { box, envelope } = heaterBoxes(hFace, heater, c, floor);
    layout.heater = { item: heater, face: hFace, box, envelope, centreAlong: c };
    if (heater.flue) {
      const along = c + heater.flue.offset_mm[0];
      const normal = hFace.plane + hFace.inward * (cl.back_mm + d / 2 + heater.flue.offset_mm[1]);
      const xy: [Mm, Mm] = hFace.axis === 0 ? [along, normal] : [normal, along];
      const slot = ctx.slots.roof?.slots.find((r) => xy[0] >= r.from_mm && xy[0] < r.to_mm);
      layout.heater.flue = { x: xy[0], y: xy[1], r: heater.flue.diameter_mm / 2, roofSlot: slot?.index };
    }
  }

  // Benches.
  const system = ctx.catalog.find('bench_system', s.benches.system);
  const mFace = roomWallFace(b, room.walls, s.benches.wall);
  if (system && mFace) {
    const used = system.levels.slice(-s.benches.levels);
    // Offsets from the wall: top level at the wall, lower levels step out.
    const offsets: Array<{ level: number; top: Mm; depth: Mm; d0: Mm; d1: Mm }> = [];
    let acc = 0;
    for (let i = used.length - 1; i >= 0; i--) {
      const l = used[i]!;
      offsets.push({ level: i, top: l.top_mm, depth: l.depth_mm, d0: acc, d1: acc + l.depth_mm });
      acc += l.depth_mm;
    }
    const total = acc;
    const segs: BenchSeg[] = [];
    const board = ctx.catalog.find('panel', system.board);
    const tb = board?.thickness_mm ?? 28;
    const mk = (leg: 'main' | 'return', wall: WallId, face: Face, along: [Mm, Mm]) => {
      for (const o of offsets) {
        const z: [Mm, Mm] = [floor, floor + o.top];
        segs.push({
          id: `${leg}-L${o.level}`,
          leg,
          wall,
          level: o.level,
          top_mm: o.top,
          depth_mm: o.depth,
          along,
          depthRange: [o.d0, o.d1],
          face,
          box: faceBox(face, along, [o.d0, o.d1], z),
          topBox: faceBox(face, along, [o.d0, o.d1], [z[1] - tb, z[1]]),
        });
      }
    };
    const mAlong: [Mm, Mm] = [Math.max(mFace.along[0], s.benches.from_mm ?? -Infinity), Math.min(mFace.along[1], s.benches.to_mm ?? Infinity)];
    mk('main', s.benches.wall, mFace, mAlong);
    if (s.benches.layout === 'L' && s.benches.returnWall) {
      const rFace = roomWallFace(b, room.walls, s.benches.returnWall);
      if (rFace && rFace.axis !== mFace.axis) {
        const len = s.benches.returnLength_mm ?? system.defaultReturnLength_mm;
        const start = mFace.plane + mFace.inward * total;
        const end = start + mFace.inward * len;
        mk('return', s.benches.returnWall, rFace, [Math.min(start, end), Math.max(start, end)]);
      }
    }
    layout.bench = { system, segs, top_mm: Math.max(...used.map((l) => l.top_mm)) };
  }

  // Doors and glass.
  for (const p of layout.roomOpenings) {
    layout.glassArea_m2 += p.product.glassArea_m2;
    if (p.product.type !== 'door') continue;
    const face = roomWallFace(b, room.walls, p.opening.wall);
    if (!face) continue;
    layout.doors.push({ placed: p, face, passage: faceBox(face, p.along, [0, lim.doorClearDepth_mm.value], p.z) });
  }

  // Uninsulated surfaces (non-insulated layups) of the room.
  const L = ctx.geo.layups;
  const dx = b.max[0] - b.min[0];
  const dy = b.max[1] - b.min[1];
  const dz = b.max[2] - b.min[2];
  if (!L.wall.insulated) {
    layout.uninsulatedArea_m2 += (2 * dx * dz) / 1e6;
    for (const w of [room.walls.west, room.walls.east]) if (w === 'W' || w === 'E') layout.uninsulatedArea_m2 += (dy * dz) / 1e6;
  }
  if (!L.partition.insulated) {
    for (const w of [room.walls.west, room.walls.east]) if (w.startsWith('P')) layout.uninsulatedArea_m2 += (dy * dz) / 1e6;
  }
  if (!L.roof.insulated) layout.uninsulatedArea_m2 += (dx * dy) / 1e6;
  return layout;
}

/** Heater casing box and clearance envelope for a placement on a face. */
export function heaterBoxes(face: Face, heater: Heater, along: Mm, floor: Mm): { box: Box3; envelope: Box3 } {
  const { w_mm: w, d_mm: d, h_mm: h } = heater.size;
  const cl = heater.clearance;
  return {
    box: faceBox(face, [along - w / 2, along + w / 2], [cl.back_mm, cl.back_mm + d], [floor, floor + h]),
    envelope: faceBox(face, [along - w / 2 - cl.side_mm, along + w / 2 + cl.side_mm], [0, cl.back_mm + d + cl.front_mm], [floor, floor + h + cl.top_mm]),
  };
}

/** Equivalent volume for heater sizing (R01). */
export function eqVolume(ctx: BuildContext, l: SaunaLayout): number {
  const lim = ctx.catalog.catalog.limits;
  return l.volume_m3 + lim.eqVolumePerGlass_m3_per_m2.value * l.glassArea_m2 + lim.eqVolumePerUninsulated_m3_per_m2.value * l.uninsulatedArea_m2;
}
