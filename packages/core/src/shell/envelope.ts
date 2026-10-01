import type { BomLine } from '../model/bom.js';
import type { BuildContext, BuildResult } from '../model/component.js';
import type { ExteriorWallId, PartitionId } from '../model/config.js';
import type { PanelNode, SceneNode } from '../model/scene.js';
import type { Mm } from '../model/units.js';
import { placedOpenings } from '../geometry/openings.js';
import { boxNode, group } from '../geometry/scene.js';
import { envelopePlane, wallFrame } from '../geometry/walls.js';
import { type AreaPatch, layerLines, layerSide, netArea } from './layers.js';

const m2 = (a: Mm, b: Mm) => (a * b) / 1e6;

/** Exterior wall: all layup layers (BOM) + cladding per slot/filler and interior lining (scene). */
export function buildWall(params: { wall: ExteriorWallId }, ctx: BuildContext): BuildResult {
  const { wall } = params;
  const id = `wall-${wall}`;
  const geo = ctx.geo;
  const layup = geo.layups.wall;
  const f = wallFrame(wall);
  const ax = f.axis;
  const nAx = f.normalAxis;
  const outer = envelopePlane(geo, wall);
  const inward = f.inward;
  const openings = placedOpenings(ctx).filter((p) => p.opening.wall === wall);
  const openingPatches: AreaPatch[] = openings.map((p) => {
    const c: [number, number, number] = [0, 0, (p.z[0] + p.z[1]) / 2];
    c[ax] = (p.along[0] + p.along[1]) / 2;
    return { area_m2: -m2(p.along[1] - p.along[0], p.z[1] - p.z[0]), c };
  });

  const bom: BomLine[] = [];
  for (const layer of layup.layers) {
    const side = layerSide(layup, layer);
    const box = side === 'ext' ? geo.envelope : side === 'structure' ? geo.structure : geo.inner;
    const a0 = box.min[ax];
    const a1 = box.max[ax];
    const z0 = box.min[2];
    const z1 = box.max[2];
    const gross: [number, number, number] = [0, 0, (z0 + z1) / 2];
    gross[ax] = (a0 + a1) / 2;
    const patches: AreaPatch[] = [{ area_m2: m2(a1 - a0, z1 - z0), c: gross }, ...openingPatches];
    if (side === 'int' && ax === 0) {
      for (const p of geo.partitions) patches.push({ area_m2: -m2(p.thickness_mm, z1 - z0), c: [p.x_mm, 0, (z0 + z1) / 2] });
    }
    const at = outer + inward * (layer.offset_mm + layer.thickness_mm / 2);
    bom.push(...layerLines(ctx, id, layup, layer, netArea(patches), { axis: nAx, at }));
  }

  // Scene: exterior cladding per slot / filler segment, with holes.
  const nodes: SceneNode[] = [];
  const clad = ctx.catalog.get('panel', ctx.config.cladding.exterior);
  const lay = ctx.slots[wall]!;
  const env = geo.envelope;
  const segs = [
    ...lay.fillers.map((s, i) => ({ a: s.from_mm, b: s.to_mm, key: `filler-${i}`, slot: undefined as number | undefined })),
    ...lay.slots.map((s) => ({ a: s.from_mm, b: s.to_mm, key: `slot-${s.index}`, slot: s.index })),
  ];
  const tClad = clad.thickness_mm;
  // Cladding ends under the roof covering (no coplanar faces at the eaves).
  const cladTop = env.max[2] - ctx.catalog.get('panel', ctx.config.cladding.roof).thickness_mm;
  const plane = ax === 0 ? 'xz' : 'yz';
  const holesIn = (a: Mm, b: Mm, zBase: Mm) =>
    openings
      .filter((p) => p.along[1] > a && p.along[0] < b)
      .map((p) => {
        const u0 = Math.max(a, p.along[0]);
        const u1 = Math.min(b, p.along[1]);
        return { u: u0 - a, v: p.z[0] - zBase, w: u1 - u0, h: p.z[1] - p.z[0] };
      });
  for (const s of segs) {
    const min: [number, number, number] = [0, 0, env.min[2]];
    min[ax] = s.a;
    min[nAx] = inward > 0 ? outer : outer - tClad;
    const n: PanelNode = {
      type: 'panel', id: `${id}/clad/${s.key}`, plane, min, width_mm: s.b - s.a, height_mm: cladTop - env.min[2], thickness_mm: tClad,
      material: clad.appearance, tags: { cutaway: `wall:${wall}`, castShadow: true },
    };
    const holes = holesIn(s.a, s.b, env.min[2]);
    if (holes.length) n.holes = holes;
    if (clad.board) n.grain = { along: ctx.config.cladding.orientation === 'vertical' ? 'u' : 'v', pitch_mm: clad.board.coverWidth_mm };
    if (s.slot !== undefined) n.tags = { ...n.tags, slot: { wall, index: s.slot } };
    nodes.push(n);
  }
  // Interior lining.
  const inner = geo.inner;
  const intPanel = ctx.catalog.get('panel', ctx.config.sauna.interiorCladding);
  const innerFace = inward > 0 ? inner.min[nAx] : inner.max[nAx];
  const lmin: [number, number, number] = [0, 0, inner.min[2]];
  lmin[ax] = inner.min[ax];
  lmin[nAx] = inward > 0 ? innerFace - intPanel.thickness_mm : innerFace;
  const lining: PanelNode = {
    type: 'panel', id: `${id}/lining`, plane, min: lmin, width_mm: inner.max[ax] - inner.min[ax], height_mm: inner.max[2] - inner.min[2],
    thickness_mm: intPanel.thickness_mm, material: intPanel.appearance, tags: { cutaway: `wall:${wall}` },
  };
  const lh = holesIn(inner.min[ax], inner.max[ax], inner.min[2]);
  if (lh.length) lining.holes = lh;
  if (intPanel.board) lining.grain = { along: 'v', pitch_mm: intPanel.board.coverWidth_mm };
  nodes.push(lining);
  return { geometry: group(id, nodes), bom, penetrations: [] };
}

/** Roof: layers over plan areas; covering per roof slot (scene). */
export function buildRoof(_p: unknown, ctx: BuildContext): BuildResult {
  const id = 'roof';
  const geo = ctx.geo;
  const layup = geo.layups.roof;
  const bom: BomLine[] = [];
  const top = geo.envelope.max[2];
  for (const layer of layup.layers) {
    const side = layerSide(layup, layer);
    const b = side === 'ext' ? geo.envelope : side === 'structure' ? geo.structure : geo.inner;
    const patches: AreaPatch[] = [
      { area_m2: m2(b.max[0] - b.min[0], b.max[1] - b.min[1]), c: [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, 0] },
    ];
    if (side === 'int') {
      for (const p of geo.partitions) patches.push({ area_m2: -m2(p.thickness_mm, b.max[1] - b.min[1]), c: [p.x_mm, (b.min[1] + b.max[1]) / 2, 0] });
    }
    bom.push(...layerLines(ctx, id, layup, layer, netArea(patches), { axis: 2, at: top - layer.offset_mm - layer.thickness_mm / 2 }));
  }
  const roof = ctx.catalog.get('panel', ctx.config.cladding.roof);
  const intPanel = ctx.catalog.get('panel', ctx.config.sauna.interiorCladding);
  const env = geo.envelope;
  const nodes: SceneNode[] = [];
  const lay = ctx.slots.roof!;
  const segs = [
    ...lay.fillers.map((s, i) => ({ a: s.from_mm, b: s.to_mm, key: `filler-${i}`, slot: undefined as number | undefined })),
    ...lay.slots.map((s) => ({ a: s.from_mm, b: s.to_mm, key: `slot-${s.index}`, slot: s.index })),
  ];
  for (const s of segs) {
    const n = boxNode(`${id}/cover/${s.key}`, { min: [s.a, env.min[1], top - roof.thickness_mm], max: [s.b, env.max[1], top] }, roof.appearance, {
      cutaway: 'roof',
      castShadow: true,
    });
    if (s.slot !== undefined) n.tags = { ...n.tags, slot: { wall: 'roof', index: s.slot } };
    nodes.push(n);
  }
  const inn = geo.inner;
  nodes.push(boxNode(`${id}/ceiling`, { min: [inn.min[0], inn.min[1], inn.max[2]], max: [inn.max[0], inn.max[1], inn.max[2] + intPanel.thickness_mm] }, intPanel.appearance, { cutaway: 'roof' }));
  return { geometry: group(id, nodes), bom, penetrations: [] };
}

/** Floor: layers bottom → top. */
export function buildFloor(_p: unknown, ctx: BuildContext): BuildResult {
  const id = 'floor';
  const geo = ctx.geo;
  const layup = geo.layups.floor;
  const bom: BomLine[] = [];
  const bottom = geo.envelope.min[2];
  for (const layer of layup.layers) {
    const side = layerSide(layup, layer);
    const b = side === 'int' ? geo.inner : geo.structure;
    const patches: AreaPatch[] = [
      { area_m2: m2(b.max[0] - b.min[0], b.max[1] - b.min[1]), c: [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, 0] },
    ];
    if (side === 'int') {
      for (const p of geo.partitions) patches.push({ area_m2: -m2(p.thickness_mm, b.max[1] - b.min[1]), c: [p.x_mm, (b.min[1] + b.max[1]) / 2, 0] });
    }
    bom.push(...layerLines(ctx, id, layup, layer, netArea(patches), { axis: 2, at: bottom + layer.offset_mm + layer.thickness_mm / 2 }));
  }
  const fin = layup.layers[layup.layers.length - 1]!;
  const finPanel = fin.sku ? ctx.catalog.find('panel', fin.sku) : undefined;
  const inn = geo.inner;
  const nodes: SceneNode[] = [
    boxNode(`${id}/finish`, { min: [inn.min[0], inn.min[1], inn.min[2] - fin.thickness_mm], max: [inn.max[0], inn.max[1], inn.min[2]] }, finPanel?.appearance ?? 'floor'),
  ];
  return { geometry: group(id, nodes), bom, penetrations: [] };
}

/** Partition between zones (perpendicular to X), centred on the zone boundary. */
export function buildPartition(params: { id: PartitionId }, ctx: BuildContext): BuildResult {
  const geo = ctx.geo;
  const p = geo.partitions.find((x) => x.id === params.id)!;
  const id = `partition-${p.id}`;
  const layup = geo.layups.partition;
  const inn = geo.inner;
  const x0 = p.x_mm - p.thickness_mm / 2;
  const openings = placedOpenings(ctx).filter((o) => o.opening.wall === p.id);
  const patches: AreaPatch[] = [
    { area_m2: m2(inn.max[1] - inn.min[1], inn.max[2] - inn.min[2]), c: [p.x_mm, (inn.min[1] + inn.max[1]) / 2, (inn.min[2] + inn.max[2]) / 2] },
    ...openings.map((o) => ({ area_m2: -m2(o.along[1] - o.along[0], o.z[1] - o.z[0]), c: [p.x_mm, (o.along[0] + o.along[1]) / 2, (o.z[0] + o.z[1]) / 2] as [number, number, number] })),
  ];
  const net = netArea(patches);
  const bom: BomLine[] = [];
  for (const layer of layup.layers) {
    bom.push(...layerLines(ctx, id, layup, layer, net, { axis: 0, at: x0 + layer.offset_mm + layer.thickness_mm / 2 }, 'interior'));
  }
  const intPanel = ctx.catalog.get('panel', ctx.config.sauna.interiorCladding);
  const n: PanelNode = {
    type: 'panel', id: `${id}/body`, plane: 'yz', min: [x0, inn.min[1], inn.min[2]], width_mm: inn.max[1] - inn.min[1], height_mm: inn.max[2] - inn.min[2],
    thickness_mm: p.thickness_mm, material: intPanel.appearance,
  };
  const holes = openings.map((o) => ({ u: o.along[0] - inn.min[1], v: o.z[0] - inn.min[2], w: o.along[1] - o.along[0], h: o.z[1] - o.z[0] }));
  if (holes.length) n.holes = holes;
  return { geometry: group(id, [n]), bom, penetrations: [] };
}
