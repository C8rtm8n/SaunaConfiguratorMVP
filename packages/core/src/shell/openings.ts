import type { BomLine } from '../model/bom.js';
import type { BuildContext, BuildResult } from '../model/component.js';
import type { SceneNode } from '../model/scene.js';
import type { Mm, Vec3 } from '../model/units.js';
import { customLine, steelLine } from '../bom/lines.js';
import { frameRecipe } from '../geometry/module.js';
import { placeOpening, type PlacedOpening } from '../geometry/openings.js';
import { boxNode, group, sectionOf, sectionSize } from '../geometry/scene.js';
import { container } from '../geometry/slots.js';
import { envelopePlane, isPartition, wallFrame } from '../geometry/walls.js';

/** Normal coordinate of the structure centre plane of a wall (or partition axis). */
export function structurePlane(ctx: BuildContext, p: PlacedOpening): { normalAxis: 0 | 1; at: Mm } {
  const w = p.opening.wall;
  if (isPartition(w)) return { normalAxis: 0, at: ctx.geo.partitions.find((x) => x.id === w)!.x_mm };
  const f = wallFrame(w);
  const lay = ctx.geo.layups.wall;
  return { normalAxis: f.normalAxis, at: envelopePlane(ctx.geo, w) + f.inward * (lay.ext_mm + lay.structure_mm / 2) };
}

function centre(ctx: BuildContext, p: PlacedOpening): Vec3 {
  const sp = structurePlane(ctx, p);
  const f = isPartition(p.opening.wall) ? { axis: 1 as const } : wallFrame(p.opening.wall);
  const c: [number, number, number] = [0, 0, (p.z[0] + p.z[1]) / 2];
  c[f.axis] = (p.along[0] + p.along[1]) / 2;
  c[sp.normalAxis] = sp.at;
  return c;
}

/** Opening product + (ISO) container cut-out / door removal. */
export function buildOpening(params: { openingId: string }, ctx: BuildContext): BuildResult {
  const o = ctx.config.openings.find((x) => x.id === params.openingId)!;
  const id = `opening-${o.id}`;
  const p = placeOpening(ctx, o);
  if (!p) return { geometry: group(id, []), bom: [], penetrations: [] };
  const pr = p.product;
  const c = centre(ctx, p);
  const asm = pr.type === 'vent' ? 'shell' : 'glazing';
  const bom: BomLine[] = [
    customLine(ctx, { componentId: id, assembly: asm, cog: c }, {
      category: 'purchased', sku: pr.sku, description: pr.name.cs, qty: 1, unit: 'ks', mass_kg: pr.mass_kg, materialCost: pr.cost, labour_h: pr.install_h,
    }),
  ];
  if (ctx.config.module.type === 'iso_20hc' && !isPartition(o.wall)) {
    const cont = container(ctx.config, ctx.catalog);
    const w = p.along[1] - p.along[0];
    const h = p.z[1] - p.z[0];
    bom.push(
      customLine(ctx, { componentId: id, assembly: 'frame', cog: c, description: `Výřez stěny kontejneru ${Math.round(w)}×${Math.round(h)}` }, {
        category: 'steel', sku: `${cont.sku}-CUT`, description: 'Výřez stěny kontejneru', material: 'Corten', qty: 1, unit: 'ks',
        mass_kg: -((w * h) / 1e6) * cont.wallSheet_kg_per_m2, materialCost: 0, labour_h: ((2 * (w + h)) / 1000) * cont.cutting_h_per_m,
      }),
    );
    if (pr.fullWall && o.wall === cont.doorEnd) {
      const S = ctx.geo.structure;
      const x = cont.doorEnd === 'E' ? S.max[0] : S.min[0];
      bom.push(
        customLine(ctx, { componentId: id, assembly: 'frame', cog: [x, (S.min[1] + S.max[1]) / 2, (S.min[2] + S.max[2]) / 2], description: 'Demontáž dveří kontejneru' }, {
          category: 'steel', sku: `${cont.sku}-DOORS`, description: 'Demontáž dveří kontejneru', material: 'Corten', qty: 1, unit: 'ks', mass_kg: -cont.doors_kg, materialCost: 0, labour_h: 2,
        }),
      );
    }
  }
  // Scene: glass / leaf as a thin box in the structure plane.
  const sp = structurePlane(ctx, p);
  const ax = sp.normalAxis === 0 ? 1 : 0;
  const min: [number, number, number] = [0, 0, p.z[0]];
  const max: [number, number, number] = [0, 0, p.z[1]];
  min[ax] = p.along[0];
  max[ax] = p.along[1];
  min[sp.normalAxis] = sp.at - 20;
  max[sp.normalAxis] = sp.at + 20;
  const nodes: SceneNode[] = [boxNode(`${id}/body`, { min, max }, pr.type === 'vent' ? 'steel-black' : 'glass')];
  return { geometry: group(id, nodes), bom, penetrations: [] };
}

/** R07: reinforcement frame around a wide opening, in the structure plane. */
export function buildReinforcement(params: { openingId: string }, ctx: BuildContext): BuildResult {
  const o = ctx.config.openings.find((x) => x.id === params.openingId)!;
  const id = `reinf-${o.id}`;
  const p = placeOpening(ctx, o);
  const m = frameRecipe(ctx.config, ctx.catalog).members.opening_reinforcement;
  if (!p || !m) return { geometry: group(id, []), bom: [], penetrations: [] };
  const prof = ctx.catalog.get('steel_profile', m.profile);
  const sz = sectionSize(prof.section);
  const sp = structurePlane(ctx, p);
  const ax = sp.normalAxis === 0 ? 1 : 0;
  const [a0, a1] = p.along;
  const [z0, z1] = p.z;
  const pt = (along: Mm, z: Mm): Vec3 => {
    const v: [number, number, number] = [0, 0, z];
    v[ax] = along;
    v[sp.normalAxis] = sp.at;
    return v;
  };
  const members: Array<[Vec3, Vec3]> = [
    [pt(a0, z1 + sz.v / 2), pt(a1, z1 + sz.v / 2)], // header
    [pt(a0 - sz.u / 2, z0), pt(a0 - sz.u / 2, z1)], // jambs
    [pt(a1 + sz.u / 2, z0), pt(a1 + sz.u / 2, z1)],
  ];
  if (p.product.sill_mm > 0) members.push([pt(a0, z0 - sz.v / 2), pt(a1, z0 - sz.v / 2)]);
  const bom: BomLine[] = [];
  const nodes: SceneNode[] = [];
  members.forEach(([from, to], i) => {
    const len = Math.abs(to[0] - from[0]) + Math.abs(to[1] - from[1]) + Math.abs(to[2] - from[2]);
    const cog: Vec3 = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2];
    bom.push(steelLine(ctx, { componentId: id, assembly: 'frame', cog }, prof.sku, len, 1));
    nodes.push({ type: 'extrude', id: `${id}/m${i}`, section: sectionOf(prof.section), from, to, material: 'steel' });
  });
  return { geometry: group(id, nodes), bom, penetrations: [] };
}
