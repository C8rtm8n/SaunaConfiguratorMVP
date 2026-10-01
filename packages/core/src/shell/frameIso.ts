import type { BomLine } from '../model/bom.js';
import type { BuildContext, BuildResult } from '../model/component.js';
import type { PanelNode, SceneNode } from '../model/scene.js';
import { customLine } from '../bom/lines.js';
import { placedOpenings } from '../geometry/openings.js';
import { boxNode, group } from '../geometry/scene.js';
import { container } from '../geometry/slots.js';
import { EXTERIOR_WALLS, wallFrame } from '../geometry/walls.js';
import { FRAME_ID } from './frameCustom.js';

/**
 * ISO container as one purchased line (tare + COG from catalog). Cut-outs and
 * the removed doors are separate negative lines (built by the opening builder).
 */
export function buildIsoFrame(_p: unknown, ctx: BuildContext): BuildResult {
  const c = container(ctx.config, ctx.catalog);
  const bom: BomLine[] = [
    customLine(ctx, { componentId: FRAME_ID, assembly: 'frame', cog: c.cog_mm }, {
      category: 'purchased', sku: c.sku, description: c.name.cs, material: 'Corten', qty: 1, unit: 'ks', mass_kg: c.tare_kg, materialCost: c.cost, labour_h: 0,
    }),
  ];
  const S = ctx.geo.structure;
  const t = ctx.geo.layups.wall.structure_mm;
  const openings = placedOpenings(ctx);
  const nodes: SceneNode[] = [];
  for (const w of EXTERIOR_WALLS) {
    const f = wallFrame(w);
    const ax = f.axis;
    const min: [number, number, number] = [S.min[0], S.min[1], S.min[2]];
    if (f.inward < 0) min[f.normalAxis] = S.max[f.normalAxis] - t;
    const n: PanelNode = {
      type: 'panel', id: `${FRAME_ID}/wall-${w}`, plane: ax === 0 ? 'xz' : 'yz', min, width_mm: S.max[ax] - S.min[ax], height_mm: S.max[2] - S.min[2],
      thickness_mm: t, material: 'container-corrugated', tags: { cutaway: `wall:${w}` },
    };
    const holes = openings
      .filter((o) => o.opening.wall === w)
      .map((o) => ({ u: o.along[0] - S.min[ax], v: o.z[0] - S.min[2], w: o.along[1] - o.along[0], h: o.z[1] - o.z[0] }));
    if (holes.length) n.holes = holes;
    nodes.push(n);
  }
  const tr = ctx.geo.layups.roof.structure_mm;
  nodes.push(boxNode(`${FRAME_ID}/roof`, { min: [S.min[0], S.min[1], S.max[2] - tr], max: [S.max[0], S.max[1], S.max[2]] }, 'container-corrugated', { cutaway: 'roof' }));
  nodes.push(boxNode(`${FRAME_ID}/floor`, { min: S.min, max: [S.max[0], S.max[1], S.min[2] + ctx.geo.layups.floor.structure_mm] }, 'container-steel'));
  return { geometry: group(FRAME_ID, nodes), bom, penetrations: [] };
}
