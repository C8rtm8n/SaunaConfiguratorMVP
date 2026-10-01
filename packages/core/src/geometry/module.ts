import type { CatalogIndex, FrameRecipe, LayupSkuToken } from '../model/catalog.js';
import type { Box3, ModuleGeometry, ResolvedLayer, ResolvedLayup, Room } from '../model/component.js';
import type { Config, PartitionId, WallId } from '../model/config.js';
import { CatalogError } from '../catalog/index.js';

export function frameRecipe(config: Config, idx: CatalogIndex): FrameRecipe {
  const r = idx.all('frame_recipe').find((f) => f.active && f.moduleType === config.module.type);
  if (!r) throw new CatalogError(`no active frame recipe for module type '${config.module.type}'`);
  return r;
}

export function layupTokens(config: Config): Record<LayupSkuToken, string> {
  return { $exterior: config.cladding.exterior, $roof: config.cladding.roof, $interior: config.sauna.interiorCladding };
}

/** Resolves tokens and real thicknesses; token layers take the chosen panel's thickness. */
export function resolveLayup(sku: string, idx: CatalogIndex, tokens: Record<string, string>): ResolvedLayup {
  const layup = idx.get('layup', sku);
  let offset = 0;
  let ext = 0;
  let structure = 0;
  let seenStructure = false;
  const layers: ResolvedLayer[] = [];
  for (const l of layup.layers) {
    let thickness = l.thickness_mm;
    let resolvedSku: string | undefined;
    if (l.kind === 'panel') {
      const isToken = l.sku.startsWith('$');
      resolvedSku = isToken ? tokens[l.sku] : l.sku;
      if (!resolvedSku) throw new CatalogError(`layup ${sku}: unresolved token ${l.sku}`);
      const panel = idx.get('panel', resolvedSku);
      if (isToken) thickness = panel.thickness_mm;
    } else if (l.kind === 'members') {
      resolvedSku = l.sku;
      idx.get('timber', l.sku);
    }
    const layer: ResolvedLayer = { kind: l.kind, thickness_mm: thickness, offset_mm: offset };
    if (resolvedSku) layer.sku = resolvedSku;
    if ((l.kind === 'members' || l.kind === 'structure') && l.fill) {
      idx.get('panel', l.fill);
      layer.fill = l.fill;
    }
    if (l.kind === 'members') layer.spacing_mm = l.spacing_mm;
    layers.push(layer);
    if (l.kind === 'structure') {
      seenStructure = true;
      structure = thickness;
    } else if (!seenStructure) {
      ext += thickness;
    }
    offset += thickness;
  }
  const total = offset;
  return {
    sku,
    layers,
    ext_mm: seenStructure ? ext : 0,
    structure_mm: structure,
    int_mm: seenStructure ? total - ext - structure : total,
    total_mm: total,
    insulated: layup.insulated,
  };
}

/**
 * D-013: custom_frame – module L/W/H are the finished outer dimensions, the
 * steel frame is inset by the exterior layers. iso_20hc – L/W/H are the
 * container dimensions, cladding is added outside.
 */
export function moduleGeometry(config: Config, idx: CatalogIndex): ModuleGeometry {
  const recipe = frameRecipe(config, idx);
  const tokens = layupTokens(config);
  const wall = resolveLayup(recipe.layups.wall, idx, tokens);
  const roof = resolveLayup(recipe.layups.roof, idx, tokens);
  const floor = resolveLayup(recipe.layups.floor, idx, tokens);
  const partition = resolveLayup(recipe.layups.partition, idx, tokens);
  const { L_mm: L, W_mm: W, H_mm: H } = config.module;

  let envelope: Box3;
  let structure: Box3;
  if (config.module.type === 'custom_frame') {
    envelope = { min: [0, 0, 0], max: [L, W, H] };
    structure = {
      min: [wall.ext_mm, wall.ext_mm, floor.ext_mm],
      max: [L - wall.ext_mm, W - wall.ext_mm, H - roof.ext_mm],
    };
  } else {
    structure = { min: [0, 0, 0], max: [L, W, H] };
    envelope = {
      min: [-wall.ext_mm, -wall.ext_mm, -floor.ext_mm],
      max: [L + wall.ext_mm, W + wall.ext_mm, H + roof.ext_mm],
    };
  }
  const wIn = wall.structure_mm + wall.int_mm;
  const inner: Box3 = {
    min: [structure.min[0] + wIn, structure.min[1] + wIn, structure.min[2] + floor.structure_mm + floor.int_mm],
    max: [structure.max[0] - wIn, structure.max[1] - wIn, structure.max[2] - roof.structure_mm - roof.int_mm],
  };

  const zones = config.zones;
  const partitions: ModuleGeometry['partitions'] = [];
  for (let k = 1; k < zones.length; k++) {
    partitions.push({ id: `P${k}` as PartitionId, x_mm: zones[k - 1]!.to_mm, thickness_mm: partition.total_mm });
  }
  const rooms: Room[] = zones.map((z, k) => {
    const first = k === 0;
    const last = k === zones.length - 1;
    const x0 = first ? inner.min[0] : z.from_mm + partition.total_mm / 2;
    const x1 = last ? inner.max[0] : z.to_mm - partition.total_mm / 2;
    return {
      zoneId: z.id,
      zoneType: z.type,
      box: { min: [x0, inner.min[1], inner.min[2]], max: [x1, inner.max[1], inner.max[2]] },
      walls: {
        S: 'S',
        N: 'N',
        west: (first ? 'W' : `P${k}`) as WallId,
        east: (last ? 'E' : `P${k + 1}`) as WallId,
      },
    };
  });

  return { envelope, structure, inner, layups: { wall, roof, floor, partition }, partitions, rooms };
}
