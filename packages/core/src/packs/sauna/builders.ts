import type { BomLine } from '../../model/bom.js';
import type { BuildContext, BuildResult, Penetration } from '../../model/component.js';
import type { InstancesNode, SceneNode } from '../../model/scene.js';
import type { Vec3 } from '../../model/units.js';
import { customLine, panelLine, purchasedLine, timberLine } from '../../bom/lines.js';
import { boxNode, group } from '../../geometry/scene.js';
import { boxCenter } from '../../util/math.js';
import { type BenchSeg, faceBox, saunaLayout } from './layout.js';

const empty = (id: string): BuildResult => ({ geometry: group(id, []), bom: [], penetrations: [] });

export function buildHeater(_p: unknown, ctx: BuildContext): BuildResult {
  const id = 'heater';
  const h = saunaLayout(ctx)?.heater;
  if (!h) return empty(id);
  const it = h.item;
  const bom: BomLine[] = [
    customLine(ctx, { componentId: id, assembly: 'heater', cog: boxCenter(h.box) }, {
      category: 'purchased', sku: it.sku, description: `${it.name.cs} vč. kamenů ${it.stones_kg} kg`, qty: 1, unit: 'ks',
      mass_kg: it.mass_kg, materialCost: it.cost, labour_h: it.install_h,
    }),
  ];
  const size: Vec3 = [h.box.max[0] - h.box.min[0], h.box.max[1] - h.box.min[1], h.box.max[2] - h.box.min[2]];
  const node: SceneNode = it.asset
    ? { type: 'asset', id: `${id}/body`, asset: it.asset, min: h.box.min, size }
    : boxNode(`${id}/body`, h.box, it.fuel === 'wood' ? 'heater-wood' : 'heater-electric', { castShadow: true });
  return { geometry: group(id, [node]), bom, penetrations: [] };
}

/** Length [m] of one bench support frame (leg + bearer) for a segment. */
const supportLen = (s: BenchSeg) => (s.top_mm + s.depth_mm) / 1000;

export function buildBenches(_p: unknown, ctx: BuildContext): BuildResult {
  const id = 'benches';
  const bench = saunaLayout(ctx)?.bench;
  if (!bench) return empty(id);
  const sys = bench.system;
  const board = ctx.catalog.get('panel', sys.board);
  const supW = ctx.catalog.get('timber', sys.support).b_mm;
  const bom: BomLine[] = [];
  const nodes: SceneNode[] = [];
  for (const s of bench.segs) {
    const len = s.along[1] - s.along[0];
    if (len <= 0) continue;
    const cog = boxCenter(s.topBox);
    bom.push(panelLine(ctx, { componentId: id, assembly: 'interior', cog }, sys.board, (len * s.depth_mm) / 1e6));
    // End supports (2 per segment); intermediate ones are added by R09.
    const supCog: Vec3 = [cog[0], cog[1], (s.box.min[2] + s.box.max[2]) / 2];
    bom.push(timberLine(ctx, { componentId: id, assembly: 'interior', cog: supCog }, sys.support, 2 * supportLen(s), (sys.assembly_h_per_m * len) / 1000));
    // Boards as instances along the bench length.
    const pitch = board.board?.coverWidth_mm ?? 100;
    const bw = board.board?.width_mm ?? 90;
    const n = Math.max(1, Math.floor(s.depth_mm / pitch));
    const inst: Vec3[] = [];
    for (let i = 0; i < n; i++) {
      const b = faceBox(s.face, s.along, [s.depthRange[0] + i * pitch, s.depthRange[0] + i * pitch + bw], [s.topBox.min[2], s.topBox.max[2]]);
      inst.push(b.min);
    }
    const one = faceBox(s.face, s.along, [0, bw], [0, board.thickness_mm]);
    const node: InstancesNode = {
      type: 'instances', id: `${id}/${s.id}/boards`, material: board.appearance,
      size: [one.max[0] - one.min[0], one.max[1] - one.min[1], board.thickness_mm], instances: inst,
    };
    nodes.push(node);
    for (const a of [s.along[0], s.along[1] - supW]) {
      nodes.push(boxNode(`${id}/${s.id}/sup-${Math.round(a)}`, faceBox(s.face, [a, a + supW], s.depthRange, [s.box.min[2], s.topBox.min[2]]), 'aspen'));
    }
  }
  return { geometry: group(id, nodes), bom, penetrations: [] };
}

/** R09: intermediate supports for a bench segment. */
export function buildBenchSupports(params: { segId: string; count: number }, ctx: BuildContext): BuildResult {
  const id = `bench-supports-${params.segId}`;
  const bench = saunaLayout(ctx)?.bench;
  const s = bench?.segs.find((x) => x.id === params.segId);
  if (!bench || !s) return empty(id);
  const cog: Vec3 = boxCenter(s.box);
  const bom = [timberLine(ctx, { componentId: id, assembly: 'interior', cog }, bench.system.support, params.count * supportLen(s))];
  const nodes: SceneNode[] = [];
  const len = s.along[1] - s.along[0];
  const supW = ctx.catalog.get('timber', bench.system.support).b_mm;
  for (let i = 1; i <= params.count; i++) {
    const a = s.along[0] + (len * i) / (params.count + 1) - supW / 2;
    nodes.push(boxNode(`${id}/${i}`, faceBox(s.face, [a, a + supW], s.depthRange, [s.box.min[2], s.topBox.min[2]]), 'aspen'));
  }
  return { geometry: group(id, nodes), bom, penetrations: [] };
}

export function buildLighting(_p: unknown, ctx: BuildContext): BuildResult {
  const id = 'lighting';
  const l = saunaLayout(ctx);
  if (!l) return empty(id);
  const b = l.room.box;
  const bom: BomLine[] = [];
  const nodes: SceneNode[] = [];
  const top = l.bench?.segs.find((s) => s.leg === 'main' && s.depthRange[0] === 0);
  ctx.config.sauna.lighting.forEach((it, i) => {
    let pos: Vec3;
    if ((it.mount === 'under_bench' || it.mount === 'backrest') && top) {
      const c = boxCenter(top.topBox);
      pos = it.mount === 'under_bench' ? [c[0], c[1], top.topBox.min[2] - 30] : [c[0], c[1], top.topBox.max[2] + 400];
      const along = top.face.axis;
      const mid = (top.along[0] + top.along[1]) / 2;
      const p = [...pos] as [number, number, number];
      p[along] = mid;
      if (it.mount === 'backrest') p[top.face.normalAxis] = top.face.plane + top.face.inward * 20;
      pos = p;
    } else {
      pos = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, it.mount === 'ceiling' ? b.max[2] - 40 : b.max[2] - 300];
    }
    bom.push(purchasedLine(ctx, { componentId: id, assembly: 'electrical', cog: pos }, it.sku, it.qty));
    nodes.push(boxNode(`${id}/${i}`, { min: [pos[0] - 40, pos[1] - 40, pos[2] - 10], max: [pos[0] + 40, pos[1] + 40, pos[2] + 10] }, 'light-emissive'));
  });
  return { geometry: group(id, nodes), bom, penetrations: [] };
}

/** R05: chimney set through the roof above a wood-burning heater. */
export function buildChimney(_p: unknown, ctx: BuildContext): BuildResult {
  const id = 'chimney';
  const h = saunaLayout(ctx)?.heater;
  if (!h?.flue || !h.item.flue) return empty(id);
  const f = h.item.flue;
  const z0 = h.box.max[2];
  const roofTop = ctx.geo.envelope.max[2];
  const z1 = roofTop + f.aboveRoof_mm;
  const cog: Vec3 = [h.flue.x, h.flue.y, (z0 + z1) / 2];
  const pen: Penetration = { id: 'flue', componentId: id, kind: 'flue', surface: 'roof', position_mm: [h.flue.x, h.flue.y, roofTop], size: { diameter_mm: f.diameter_mm } };
  return {
    geometry: group(id, [{ type: 'cylinder', id: `${id}/pipe`, radius_mm: h.flue.r, from: [h.flue.x, h.flue.y, z0], to: [h.flue.x, h.flue.y, z1], material: 'steel-stainless' }]),
    bom: [purchasedLine(ctx, { componentId: id, assembly: 'chimney', cog }, f.chimneySku, 1)],
    penetrations: [pen],
  };
}

/** R06: supply at/below the heater, exhaust diagonally opposite under the ceiling. */
export function buildVentilation(params: { supply: Vec3; exhaust: Vec3; supplyWall: string; exhaustWall: string }, ctx: BuildContext): BuildResult {
  const id = 'ventilation';
  const v = ctx.catalog.catalog.limits.ventilation;
  const pens: Penetration[] = [
    { id: 'vent-supply', componentId: id, kind: 'vent_supply', surface: params.supplyWall as Penetration['surface'], position_mm: params.supply, size: { diameter_mm: v.diameter_mm } },
    { id: 'vent-exhaust', componentId: id, kind: 'vent_exhaust', surface: params.exhaustWall as Penetration['surface'], position_mm: params.exhaust, size: { diameter_mm: v.diameter_mm } },
  ];
  const r = v.diameter_mm / 2;
  const node = (n: string, p: Vec3): SceneNode => boxNode(`${id}/${n}`, { min: [p[0] - r, p[1] - r, p[2] - r], max: [p[0] + r, p[1] + r, p[2] + r] }, 'steel-black');
  return {
    geometry: group(id, [node('supply', params.supply), node('exhaust', params.exhaust)]),
    bom: [
      purchasedLine(ctx, { componentId: id, assembly: 'shell', cog: params.supply, description: 'Větrací mřížka – přívod' }, v.grilleSku, 1),
      purchasedLine(ctx, { componentId: id, assembly: 'shell', cog: params.exhaust, description: 'Větrací mřížka – odvod' }, v.grilleSku, 1),
    ],
    penetrations: pens,
  };
}

