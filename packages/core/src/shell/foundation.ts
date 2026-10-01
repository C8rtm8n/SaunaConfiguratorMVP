import type { BomLine } from '../model/bom.js';
import type { CatalogIndex, FoundationSystem } from '../model/catalog.js';
import type { BuildContext, BuildResult, ModuleGeometry } from '../model/component.js';
import type { Config } from '../model/config.js';
import type { SceneNode } from '../model/scene.js';
import type { Mm, Vec3 } from '../model/units.js';
import { purchasedLine, steelLine } from '../bom/lines.js';
import { frameRecipe } from '../geometry/module.js';
import { boxNode, group, sectionOf, sectionSize } from '../geometry/scene.js';

export function foundationSystem(config: Config, idx: CatalogIndex): FoundationSystem {
  const f = idx.all('foundation').find((x) => x.active && x.type === config.foundation);
  if (!f) throw new Error(`no active foundation system for '${config.foundation}'`);
  return f;
}

/** Distance of the base rail centre line from the structure edge. */
export function baseRailInset(config: Config, idx: CatalogIndex): Mm {
  if (config.module.type === 'iso_20hc') {
    return idx.all('container').find((c) => c.L_mm === config.module.L_mm)!.cornerPost_mm / 2;
  }
  const m = frameRecipe(config, idx).members.base_perimeter!;
  return sectionSize(idx.get('steel_profile', m.profile).section).u / 2;
}

/** Positions along X: both ends + evenly spaced so that no gap exceeds maxSpacing. */
export function supportXs(geo: ModuleGeometry, inset: Mm, maxSpacing: Mm): Mm[] {
  const a = geo.structure.min[0] + inset;
  const b = geo.structure.max[0] - inset;
  const n = Math.max(1, Math.ceil((b - a) / maxSpacing - 1e-9));
  return Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
}

/** Support points under the two long base members (x, y at the base underside). */
export function supportPoints(config: Config, idx: CatalogIndex, geo: ModuleGeometry): Vec3[] {
  const f = foundationSystem(config, idx);
  const inset = baseRailInset(config, idx);
  const S = geo.structure;
  const ys = [S.min[1] + inset, S.max[1] - inset];
  return supportXs(geo, inset, f.maxSpacing_mm).flatMap((x) => ys.map((y): Vec3 => [x, y, S.min[2]]));
}

export function buildFoundation(_p: unknown, ctx: BuildContext): BuildResult {
  const id = 'foundation';
  const f = foundationSystem(ctx.config, ctx.catalog);
  const pts = supportPoints(ctx.config, ctx.catalog, ctx.geo);
  const S = ctx.geo.structure;
  const bom: BomLine[] = [];
  const nodes: SceneNode[] = [];
  const base = { componentId: id, assembly: 'foundation' as const, transport: 'demounted' as const };
  const part = ctx.catalog.get('purchased', f.pointSku);
  const size = part.size_mm ?? [200, 200, 200];
  let zTop = S.min[2];
  if (f.type === 'beams' && f.beamProfile) {
    const prof = ctx.catalog.get('steel_profile', f.beamProfile);
    const h = prof.section.shape === 'U' ? prof.section.h : 120;
    const over = f.beamOverhang_mm ?? 0;
    const xs = [...new Set(pts.map((p) => p[0]))];
    for (const [i, x] of xs.entries()) {
      const from: Vec3 = [x, S.min[1] - over, S.min[2] - h / 2];
      const to: Vec3 = [x, S.max[1] + over, S.min[2] - h / 2];
      bom.push(steelLine(ctx, { ...base, cog: [x, (S.min[1] + S.max[1]) / 2, S.min[2] - h / 2] }, prof.sku, to[1] - from[1], 1, { welded: false }));
      nodes.push({ type: 'extrude', id: `${id}/skid/${i}`, section: sectionOf(prof.section), from, to, roll: Math.PI / 2, material: 'steel' });
    }
    zTop = S.min[2] - h;
  }
  pts.forEach((p, i) => {
    const cog: Vec3 = [p[0], p[1], zTop - size[2] / 2];
    bom.push(purchasedLine(ctx, { ...base, cog }, f.pointSku, 1));
    nodes.push(boxNode(`${id}/pt/${i}`, { min: [p[0] - size[0] / 2, p[1] - size[1] / 2, zTop - size[2]], max: [p[0] + size[0] / 2, p[1] + size[1] / 2, zTop] }, f.type === 'screws' ? 'steel-galv' : 'concrete'));
  });
  return { geometry: group(id, nodes), bom, penetrations: [] };
}
