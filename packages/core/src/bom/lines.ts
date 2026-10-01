import type { AssemblyId, BomCategory, BomLine, BomUnit } from '../model/bom.js';
import type { BuildContext } from '../model/component.js';
import type { PriceCategory } from '../model/catalog.js';
import type { Kg, Mm, Vec3 } from '../model/units.js';
import { frameRecipe } from '../geometry/module.js';

interface Common {
  componentId: string;
  assembly: AssemblyId;
  cog: Vec3;
  description?: string;
  transport?: 'fixed' | 'demounted';
}

const MARGIN_CAT: Record<BomCategory, PriceCategory> = { steel: 'steel', timber: 'timber', purchased: 'purchased' };

function finish(
  ctx: BuildContext,
  base: Common,
  l: {
    category: BomCategory;
    sku: string;
    description: string;
    material: string;
    profile?: string;
    qty: number;
    unit: BomUnit;
    len_mm?: Mm;
    mass_kg: Kg;
    surface_m2?: number;
    materialCost: number;
    labour_h: number;
    waste: number;
  },
): BomLine {
  const rates = ctx.catalog.catalog.rates;
  const labourCost = l.labour_h * rates.labour_per_h;
  const price = l.materialCost * (1 + rates.margin[MARGIN_CAT[l.category]]) + labourCost * (1 + rates.margin.labour);
  const line: BomLine = {
    pos: '',
    componentId: base.componentId,
    assembly: base.assembly,
    category: l.category,
    sku: l.sku,
    description: base.description ?? l.description,
    material: l.material,
    qty: l.qty,
    unit: l.unit,
    mass_kg: l.mass_kg,
    cog_mm: base.cog,
    cost: l.materialCost + labourCost,
    materialCost: l.materialCost,
    labourCost,
    price,
    waste_pct: l.waste,
    labour_h: l.labour_h,
    transport: base.transport ?? 'fixed',
  };
  if (l.profile !== undefined) line.profile = l.profile;
  if (l.len_mm !== undefined) line.len_mm = l.len_mm;
  if (l.surface_m2 !== undefined) line.surface_m2 = l.surface_m2;
  return line;
}

/** Steel member(s) of one cut length. Mass = kg/m × length × count (nominal, without waste). */
export function steelLine(ctx: BuildContext, base: Common, profileSku: string, len_mm: Mm, count: number, opts: { welded?: boolean } = {}): BomLine {
  const p = ctx.catalog.get('steel_profile', profileSku);
  const steel = ctx.catalog.get('steel', p.material);
  const mass = (p.mass_kg_per_m * len_mm * count) / 1000;
  const surface = (p.surface_m2_per_m * len_mm * count) / 1000;
  const welded = opts.welded ?? true;
  return finish(ctx, base, {
    category: 'steel',
    sku: p.sku,
    description: p.name.cs,
    material: steel.grade,
    profile: p.designation,
    qty: count,
    unit: 'ks',
    len_mm,
    mass_kg: mass,
    surface_m2: surface,
    materialCost: mass * (1 + p.waste) * steel.cost_per_kg + surface * steel.coating_cost_per_m2,
    labour_h: welded ? mass * frameRecipe(ctx.config, ctx.catalog).welding_h_per_kg : 0,
    waste: p.waste,
  });
}

/** Area material (cladding, insulation, membranes, boards). */
export function panelLine(ctx: BuildContext, base: Common, sku: string, area_m2: number): BomLine {
  const p = ctx.catalog.get('panel', sku);
  return finish(ctx, base, {
    category: 'timber',
    sku,
    description: p.name.cs,
    material: p.material,
    qty: area_m2,
    unit: 'm2',
    mass_kg: area_m2 * p.mass_kg_per_m2,
    materialCost: area_m2 * (1 + p.waste) * p.cost_per_m2,
    labour_h: area_m2 * p.install_h_per_m2,
    waste: p.waste,
  });
}

/** Linear timber [m]. Mass from section × density. Labour is in the panel install rates. */
export function timberLine(ctx: BuildContext, base: Common, sku: string, length_m: number, labour_h = 0): BomLine {
  const t = ctx.catalog.get('timber', sku);
  return finish(ctx, base, {
    category: 'timber',
    sku,
    description: t.name.cs,
    material: t.species,
    profile: `${t.h_mm}×${t.b_mm}`,
    qty: length_m,
    unit: 'm',
    mass_kg: (t.b_mm / 1000) * (t.h_mm / 1000) * length_m * t.density_kg_m3,
    materialCost: length_m * (1 + t.waste) * t.cost_per_m,
    labour_h,
    waste: t.waste,
  });
}

/** Purchased part by piece. */
export function purchasedLine(ctx: BuildContext, base: Common, sku: string, qty: number): BomLine {
  const p = ctx.catalog.get('purchased', sku);
  return finish(ctx, { ...base, transport: base.transport ?? (p.demountable ? 'demounted' : 'fixed') }, {
    category: 'purchased',
    sku,
    description: p.name.cs,
    material: '',
    qty,
    unit: 'ks',
    mass_kg: p.mass_kg * qty,
    materialCost: p.cost * qty,
    labour_h: p.install_h * qty,
    waste: 0,
  });
}

/** Generic line for items not in the simple kinds (container, opening products, attachments, cut-outs). */
export function customLine(
  ctx: BuildContext,
  base: Common,
  l: { category: BomCategory; sku: string; description: string; material?: string; qty: number; unit: BomUnit; mass_kg: Kg; materialCost: number; labour_h: number; waste?: number; profile?: string },
): BomLine {
  return finish(ctx, base, { material: '', waste: 0, ...l });
}
