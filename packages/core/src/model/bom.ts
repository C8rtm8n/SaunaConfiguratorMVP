import type { Czk, Id, Kg, Mm, Ratio, SkuRef, Vec3 } from './units.js';

/** Mass / BOM grouping (mass sheet, tech PDF). */
export type AssemblyId =
  | 'frame'
  | 'shell'
  | 'insulation'
  | 'interior'
  | 'glazing'
  | 'heater'
  | 'chimney'
  | 'electrical'
  | 'terrace'
  | 'attachments'
  | 'foundation';

/** BOM XLSX sheet. */
export type BomCategory = 'steel' | 'timber' | 'purchased';

export type BomUnit = 'ks' | 'm' | 'm2' | 'm3' | 'kg';

/**
 * One raw BOM line as emitted by a component builder (one piece or one
 * homogeneous group of pieces at a known COG).
 * `pos` is assigned after aggregation (`aggregateBom`), deterministically.
 */
export interface BomLine {
  pos: string;
  /** Component that produced the line (for diff, highlighting, debugging). */
  componentId: Id;
  assembly: AssemblyId;
  category: BomCategory;
  sku: SkuRef;
  description: string;
  /** Material grade / species ('S235JRH', 'thermowood borovice'). */
  material: string;
  /** Profile designation for steel ('RHS 100×100×4'). */
  profile?: string;
  /** Net quantity (without waste) in `unit`. */
  qty: number;
  unit: BomUnit;
  /** Cut length per piece for linear members. */
  len_mm?: Mm;
  /** Total net mass of the line (not per piece). Waste is not shipped. Negative = removed material (ISO cut-out). */
  mass_kg: Kg;
  /** COG of the line in module coordinates. */
  cog_mm: Vec3;
  /** Coating surface for steel [m²]. */
  surface_m2?: number;
  /** Cost incl. waste, material + labour, Kč bez DPH. */
  cost: Czk;
  /** Split of `cost` into material and labour (for the price breakdown). */
  materialCost: Czk;
  labourCost: Czk;
  /** Sell price = cost × (1 + category margin). */
  price: Czk;
  waste_pct: Ratio;
  /** Labour hours included in cost. */
  labour_h: number;
  /** 'demounted' = shipped separately / installed on site (chimney, railing, terrace). */
  transport: 'fixed' | 'demounted';
}

/** Aggregated row for exports (same sku + len + assembly). */
export interface BomRow extends Omit<BomLine, 'componentId' | 'cog_mm'> {
  componentIds: Id[];
}
