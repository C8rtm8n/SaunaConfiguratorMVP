import type { BuildContext, BuildResult, Box3 } from '../model/component.js';
import type { Attachment, ExteriorWallId, TerraceAttachment } from '../model/config.js';
import type { Mm } from '../model/units.js';
import { customLine } from '../bom/lines.js';
import { boxNode, group } from '../geometry/scene.js';
import { envelopePlane, wallFrame } from '../geometry/walls.js';
import { boxCenter } from '../util/math.js';

/** Plan box of an element projecting `depth` out of exterior wall `w` over along range [a0, a1]. */
function outBox(ctx: BuildContext, w: ExteriorWallId, a0: Mm, a1: Mm, n0: Mm, n1: Mm, z0: Mm, z1: Mm): Box3 {
  const f = wallFrame(w);
  const outer = envelopePlane(ctx.geo, w);
  const out = -f.inward;
  const min: [number, number, number] = [0, 0, z0];
  const max: [number, number, number] = [0, 0, z1];
  min[f.axis] = a0;
  max[f.axis] = a1;
  const p = outer + out * n0;
  const q = outer + out * n1;
  min[f.normalAxis] = Math.min(p, q);
  max[f.normalAxis] = Math.max(p, q);
  return { min, max };
}

export function terraceAlong(ctx: BuildContext, t: TerraceAttachment): [Mm, Mm] {
  const lay = ctx.slots[t.wall]!;
  if (t.slotFrom !== undefined && t.slotTo !== undefined) {
    const a = lay.slots[t.slotFrom];
    const b = lay.slots[t.slotTo];
    if (a && b) return [a.from_mm, b.to_mm];
  }
  return [lay.from_mm, lay.to_mm];
}

/** Side edges of a terrace on wall w: [edge at along-min, edge at along-max]. */
export function sideEdges(w: ExteriorWallId): [ExteriorWallId, ExteriorWallId] {
  return wallFrame(w).axis === 0 ? ['W', 'E'] : ['S', 'N'];
}

function stairsWidth(ctx: BuildContext, terraceId: string, edge: ExteriorWallId): Mm {
  let w = 0;
  for (const a of ctx.config.attachments) {
    if (a.type === 'stairs' && a.attachTo === terraceId && a.edge === edge) w += ctx.catalog.get('attachment_system', a.sku).width_mm ?? 0;
  }
  return w;
}

export function attachmentBox(ctx: BuildContext, a: Attachment): Box3 | undefined {
  const sys = ctx.catalog.find('attachment_system', a.sku);
  if (!sys) return undefined;
  const deckTop = ctx.geo.inner.min[2];
  const ground = ctx.geo.envelope.min[2];
  switch (a.type) {
    case 'terrace': {
      const [a0, a1] = terraceAlong(ctx, a);
      return outBox(ctx, a.wall, a0, a1, 0, a.depth_mm, deckTop - (sys.thickness_mm ?? 150), deckTop);
    }
    case 'roof_overhang': {
      const lay = ctx.slots[a.wall]!;
      const top = ctx.geo.envelope.max[2];
      return outBox(ctx, a.wall, lay.from_mm, lay.to_mm, 0, a.depth_mm, top - (sys.thickness_mm ?? 120), top);
    }
    case 'stairs': {
      const width = sys.width_mm ?? 1000;
      const run = sys.thickness_mm ?? 900;
      const terrace = ctx.config.attachments.find((x): x is TerraceAttachment => x.type === 'terrace' && x.id === a.attachTo);
      const wall = terrace ? terrace.wall : (a.attachTo as ExteriorWallId);
      const lay = ctx.slots[wall];
      if (!lay) return undefined;
      const slot = lay.slots[a.slot];
      const centre = slot ? (slot.from_mm + slot.to_mm) / 2 : (lay.from_mm + lay.to_mm) / 2;
      if (!terrace) return outBox(ctx, wall, centre - width / 2, centre + width / 2, 0, run, ground, deckTop);
      const [t0, t1] = terraceAlong(ctx, terrace);
      if (a.edge === terrace.wall) {
        const c = Math.min(Math.max(centre, t0 + width / 2), t1 - width / 2);
        return outBox(ctx, wall, c - width / 2, c + width / 2, terrace.depth_mm, terrace.depth_mm + run, ground, deckTop);
      }
      const [eMin] = sideEdges(terrace.wall);
      const mid = terrace.depth_mm / 2;
      return a.edge === eMin
        ? outBox(ctx, wall, t0 - run, t0, mid - width / 2, mid + width / 2, ground, deckTop)
        : outBox(ctx, wall, t1, t1 + run, mid - width / 2, mid + width / 2, ground, deckTop);
    }
    case 'railing':
      return undefined;
  }
}

export function buildAttachment(params: { attachmentId: string }, ctx: BuildContext): BuildResult {
  const a = ctx.config.attachments.find((x) => x.id === params.attachmentId)!;
  const id = `att-${a.id}`;
  const sys = ctx.catalog.find('attachment_system', a.sku);
  if (!sys) return { geometry: group(id, []), bom: [], penetrations: [] };
  const transport = sys.demountable ? ('demounted' as const) : ('fixed' as const);
  const assembly = a.type === 'roof_overhang' ? ('attachments' as const) : ('terrace' as const);
  const line = (qty: number, cog: [number, number, number] | readonly [number, number, number], desc?: string) =>
    customLine(ctx, { componentId: id, assembly, cog, transport, ...(desc ? { description: desc } : {}) }, {
      category: 'purchased', sku: sys.sku, description: sys.name.cs, qty, unit: sys.basis,
      mass_kg: qty * sys.mass_kg_per_unit, materialCost: qty * sys.cost_per_unit, labour_h: qty * sys.install_h_per_unit,
    });

  if (a.type === 'railing') {
    const terrace = ctx.config.attachments.find((x): x is TerraceAttachment => x.type === 'terrace' && x.id === a.attachTo);
    if (!terrace) return { geometry: group(id, []), bom: [], penetrations: [] };
    const [t0, t1] = terraceAlong(ctx, terrace);
    const deckTop = ctx.geo.inner.min[2];
    const h = sys.height_mm ?? 1000;
    const [eMin, eMax] = sideEdges(terrace.wall);
    const bom = [];
    const nodes = [];
    for (const edge of a.edges) {
      let b: Box3 | undefined;
      let len: Mm;
      if (edge === terrace.wall) {
        b = outBox(ctx, terrace.wall, t0, t1, terrace.depth_mm - 40, terrace.depth_mm, deckTop, deckTop + h);
        len = t1 - t0;
      } else if (edge === eMin || edge === eMax) {
        const a0 = edge === eMin ? t0 : t1 - 40;
        b = outBox(ctx, terrace.wall, a0, a0 + 40, 0, terrace.depth_mm, deckTop, deckTop + h);
        len = terrace.depth_mm;
      } else continue;
      len = Math.max(0, len - stairsWidth(ctx, terrace.id, edge));
      if (len <= 0) continue;
      bom.push(line(len / 1000, boxCenter(b), `${sys.name.cs} – hrana ${edge}`));
      nodes.push(boxNode(`${id}/${edge}`, b, sys.appearance));
    }
    return { geometry: group(id, nodes), bom, penetrations: [] };
  }

  const b = attachmentBox(ctx, a);
  if (!b) return { geometry: group(id, []), bom: [], penetrations: [] };
  const qty = sys.basis === 'm2' ? ((b.max[0] - b.min[0]) * (b.max[1] - b.min[1])) / 1e6 : 1;
  return {
    geometry: group(id, [boxNode(`${id}/body`, b, sys.appearance, { castShadow: true })]),
    bom: [line(qty, boxCenter(b))],
    penetrations: [],
  };
}
