import type { AssemblyId, BomLine } from '../model/bom.js';
import type { BuildContext, ResolvedLayer, ResolvedLayup } from '../model/component.js';
import type { Vec3 } from '../model/units.js';
import { panelLine, timberLine } from '../bom/lines.js';

/** Area patch with centroid; negative area = deduction (opening, partition). */
export interface AreaPatch {
  area_m2: number;
  /** Centroid; the coordinate along the layer normal is overridden per layer. */
  c: Vec3;
}

export function netArea(patches: AreaPatch[]): AreaPatch {
  let a = 0;
  const s = [0, 0, 0];
  for (const p of patches) {
    a += p.area_m2;
    for (let i = 0; i < 3; i++) s[i]! += p.area_m2 * p.c[i]!;
  }
  return { area_m2: a, c: a === 0 ? [0, 0, 0] : [s[0]! / a, s[1]! / a, s[2]! / a] };
}

/** Which side of the structure a layer lies on. */
export function layerSide(layup: ResolvedLayup, layer: ResolvedLayer): 'ext' | 'structure' | 'int' {
  if (layer.kind === 'structure') return 'structure';
  return layer.offset_mm < layup.ext_mm ? 'ext' : 'int';
}

/**
 * BOM lines of one layer over a net area. `normal` places the layer's centre
 * plane (index of the axis + coordinate).
 */
export function layerLines(
  ctx: BuildContext,
  componentId: string,
  layup: ResolvedLayup,
  layer: ResolvedLayer,
  area: AreaPatch,
  normal: { axis: 0 | 1 | 2; at: number },
  extAssembly: AssemblyId = 'shell',
): BomLine[] {
  if (area.area_m2 <= 0) return [];
  const c = [...area.c] as [number, number, number];
  c[normal.axis] = normal.at;
  const side = layerSide(layup, layer);
  const asmFor = (sku: string): AssemblyId => {
    const p = ctx.catalog.find('panel', sku);
    if (p && p.role === 'insulation') return 'insulation';
    return side === 'ext' ? extAssembly : 'interior';
  };
  const base = (assembly: AssemblyId) => ({ componentId, assembly, cog: c as Vec3 });
  const out: BomLine[] = [];
  if (layer.kind === 'panel' && layer.sku) {
    out.push(panelLine(ctx, base(asmFor(layer.sku)), layer.sku, area.area_m2));
  } else if (layer.kind === 'members' && layer.sku) {
    const spacing = layer.spacing_mm ?? 600;
    const t = ctx.catalog.get('timber', layer.sku);
    out.push(timberLine(ctx, base(side === 'ext' ? extAssembly : 'interior'), layer.sku, area.area_m2 / (spacing / 1000)));
    if (layer.fill) out.push(panelLine(ctx, base(asmFor(layer.fill)), layer.fill, area.area_m2 * (1 - t.b_mm / spacing)));
  } else if (layer.kind === 'structure' && layer.fill) {
    out.push(panelLine(ctx, base('insulation'), layer.fill, area.area_m2));
  }
  return out;
}
