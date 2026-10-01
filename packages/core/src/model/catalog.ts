import type { GridMm, ModuleType, OpeningType } from './config.js';
import type { I18nText } from './i18n.js';
import type { RuleDef } from './rules.js';
import type { Czk, Kg, Kw, M3, Mm, Ratio, SkuRef, Vec3 } from './units.js';

/**
 * Tenant catalog = every domain number (dimensions, masses, clearances,
 * limits, rates). Code never hard-codes a domain value. Versioned and
 * immutable once a config references it.
 */

/** Provenance of a value; required for anything not obvious. */
export interface Source {
  /** e.g. "EN 10219-2 tab. B.1", "Harvia manuál str. 12", "interní standard". */
  ref: string;
  /** true = unverified placeholder; shown as a warning in admin and tech PDF. */
  placeholder?: boolean;
}

interface ItemBase {
  sku: SkuRef;
  name: I18nText;
  active: boolean;
  source?: Source;
}

// ------------------------------------------------------------ materials ---

/** Structural steel grade. */
export interface SteelMaterial extends ItemBase {
  kind: 'steel';
  grade: string; // 'S235JRH', 'S355J2H'
  density_kg_m3: number;
  /** Material purchase price per kg. */
  cost_per_kg: Czk;
  /** Surface treatment price per m² (painting / galvanising). */
  coating_cost_per_m2: Czk;
}

export type ProfileShape =
  | { shape: 'RHS'; h: Mm; b: Mm; t: Mm; r_out?: Mm }
  | { shape: 'U'; h: Mm; b: Mm; tw: Mm; tf: Mm }
  | { shape: 'L'; a: Mm; b: Mm; t: Mm }
  | { shape: 'FLAT'; b: Mm; t: Mm };

export interface SteelProfile extends ItemBase {
  kind: 'steel_profile';
  /** Steel material SKU. */
  material: SkuRef;
  section: ProfileShape;
  /** Nominal mass per metre (from standard table, not computed). */
  mass_kg_per_m: Kg;
  /** Outer surface per metre for coating [m²/m]. */
  surface_m2_per_m: number;
  waste: Ratio;
}

export type PanelRole =
  | 'exterior_cladding'
  | 'roof_covering'
  | 'interior_cladding'
  | 'insulation'
  | 'membrane'
  | 'vapour_barrier'
  | 'sheathing'
  | 'batten'
  | 'floor'
  | 'bench_board'
  | 'decking';

/** Anything sold by area or by board (cladding, insulation, membranes, decking). */
export interface PanelMaterial extends ItemBase {
  kind: 'panel';
  role: PanelRole;
  thickness_mm: Mm;
  mass_kg_per_m2: Kg;
  cost_per_m2: Czk;
  waste: Ratio;
  combustible: boolean;
  /** Board geometry for instanced lamellas (omitted for sheets / rolls). */
  board?: { width_mm: Mm; coverWidth_mm: Mm; profile: 'rhombus' | 'tongue_groove' | 'flat' | 'trapezoid' };
  /** Viewer material id (PBR set). */
  appearance: string;
}

// -------------------------------------------------------------- layups ---

/** One layer of a wall/roof/floor build-up, from outside to inside. */
export type LayupLayer =
  | { kind: 'panel'; sku: SkuRef; thickness_mm: Mm }
  /** Battens / studs: linear members at a spacing, gap filled by the next layer. */
  | { kind: 'members'; sku: SkuRef; thickness_mm: Mm; spacing_mm: Mm; memberWidth_mm: Mm }
  | { kind: 'air'; thickness_mm: Mm };

export interface Layup extends ItemBase {
  kind: 'layup';
  surface: 'wall' | 'roof' | 'floor' | 'partition';
  moduleTypes: ModuleType[];
  /** Placeholders replaced by the chosen cladding SKU at evaluation time. */
  layers: LayupLayer[];
  /** true = counts as insulated for the equivalent sauna volume. */
  insulated: boolean;
}

// ------------------------------------------------------------ structure ---

export type FrameMemberRole =
  | 'base_perimeter'
  | 'base_crossmember'
  | 'column_corner'
  | 'column_grid'
  | 'top_perimeter'
  | 'roof_beam'
  | 'roof_purlin'
  | 'opening_reinforcement'
  | 'lifting_point';

/** Data-driven frame topology for a module type (D-008, needs your approval). */
export interface FrameRecipe extends ItemBase {
  kind: 'frame_recipe';
  moduleType: ModuleType;
  members: Array<{
    role: FrameMemberRole;
    profile: SkuRef;
    /** Max spacing for repeated members; actual spacing follows the grid. */
    maxSpacing_mm?: Mm;
  }>;
  /** Welding labour [h/kg of welded steel]. */
  welding_h_per_kg: number;
}

/** Purchased ISO container shell (tare + modifications are separate BOM lines). */
export interface ContainerShell extends ItemBase {
  kind: 'container';
  iso: '20HC';
  L_mm: Mm;
  W_mm: Mm;
  H_mm: Mm;
  tare_kg: Kg;
  /** COG of the empty container in module coordinates. */
  cog_mm: Vec3;
  cost: Czk;
  /** Usable slot band per wall (corner posts, door end excluded). */
  slotBands: Partial<Record<'N' | 'S' | 'E' | 'W', { from_mm: Mm; to_mm: Mm }>>;
}

// ------------------------------------------------------------- openings ---

export interface OpeningProduct extends ItemBase {
  kind: 'opening';
  type: OpeningType;
  /** Nominal product size. */
  width_mm: Mm;
  height_mm: Mm;
  /** Sill height above finished floor (0 for doors / glass fronts). */
  sill_mm: Mm;
  /** Number of slots the product occupies per grid. Missing grid = not allowed. */
  slots: Partial<Record<GridMm, number>>;
  /** Door clear width (rule R04). */
  clearWidth_mm?: Mm;
  glassArea_m2: number;
  mass_kg: Kg;
  cost: Czk;
  /** Install labour [h/pc]. */
  install_h: number;
  combustible: boolean;
  /** Optional GLB for the frame/leaf; panel cut-out geometry is generated. */
  asset?: string;
  /** Allowed module types (ISO may restrict). */
  moduleTypes: ModuleType[];
}

// ---------------------------------------------------------------- sauna ---

export interface Heater extends ItemBase {
  kind: 'heater';
  fuel: 'wood' | 'electric';
  power_kw: Kw;
  volume_min_m3: M3;
  volume_max_m3: M3;
  /** Safety clearances to combustible material, from heater casing. */
  clearance: { side_mm: Mm; front_mm: Mm; back_mm: Mm; top_mm: Mm };
  /** Casing footprint and height. */
  size: { w_mm: Mm; d_mm: Mm; h_mm: Mm };
  /** Mass incl. stones. */
  mass_kg: Kg;
  stones_kg: Kg;
  minCabinHeight_mm: Mm;
  cost: Czk;
  electrical?: { voltage: 230 | 400; phases: 1 | 3 };
  flue?: {
    diameter_mm: Mm;
    /** Clearance of the insulated flue to combustibles. */
    clearanceCombustible_mm: Mm;
    /** Chimney set (purchased) added to BOM by rule R05. */
    chimneySku: SkuRef;
  };
  asset?: string;
}

export interface BenchSystem extends ItemBase {
  kind: 'bench_system';
  /** Levels from the bottom; top_mm = bench top above finished floor. */
  levels: Array<{ top_mm: Mm; depth_mm: Mm }>;
  board: SkuRef;
  /** Substructure profile / timber SKU and max unsupported span (rule R09). */
  support: SkuRef;
  maxSpan_mm: Mm;
  assembly_h_per_m: number;
}

/** Purchased parts: lights, chimney sets, vents, fixings, accessories. */
export interface PurchasedPart extends ItemBase {
  kind: 'purchased';
  category: 'light' | 'chimney' | 'vent' | 'electrical' | 'accessory' | 'foundation' | 'fixing';
  unit: 'ks' | 'm' | 'kg';
  mass_kg: Kg;
  cost: Czk;
  install_h: number;
  /** Removed for transport (chimney, railing…). */
  demountable: boolean;
  asset?: string;
}

/** Terrace / overhang / stairs / railing systems; dimensions driven by config. */
export interface AttachmentSystem extends ItemBase {
  kind: 'attachment_system';
  type: 'terrace' | 'roof_overhang' | 'stairs' | 'railing';
  allowedDepths_mm?: Mm[];
  /** Mass and cost per m² of plan (terrace, overhang) or per m (railing) or per pc (stairs). */
  basis: 'm2' | 'm' | 'ks';
  mass_kg_per_unit: Kg;
  cost_per_unit: Czk;
  install_h_per_unit: number;
  demountable: boolean;
  /** Members / boards used for geometry. */
  profile?: SkuRef;
  board?: SkuRef;
}

/** Electrical sizing table row (rule R10). Informative only. */
export interface ElectricalRow {
  maxPower_kw: Kw;
  voltage: 230 | 400;
  breaker_A: number;
  cable: string; // e.g. 'CYKY-J 5×2,5'
  source: Source;
}

// ---------------------------------------------------------------- rates ---

export type PriceDisplayMode = 'hidden' | 'range' | 'exact';
export type PriceCategory = 'steel' | 'timber' | 'purchased' | 'labour' | 'transport' | 'crane';

export interface Rates {
  labour_per_h: Czk;
  /** Assembly labour of cladding/interior [h/m²]. */
  assembly_h_per_m2: number;
  transport: { per_km: Czk; flat: Czk; defaultDistance_km: number };
  crane: { flat: Czk; per_h: Czk; defaultHours: number };
  /** Margin per category on top of cost. price = cost × (1 + margin). */
  margin: Record<PriceCategory, Ratio>;
  priceDisplay: PriceDisplayMode;
  /** Half-width of the shown range (0.10 = ±10 %). */
  priceRange: Ratio;
  /** Presentation only. */
  eurPerCzk: number;
}

// --------------------------------------------------------------- limits ---

/** Every rule threshold and physical coefficient lives here, with a source. */
export interface Limits {
  zoneMinLength_mm: Record<string, { value: Mm; source: Source }>;
  /** Equivalent volume: +k m³ per m² of glass / uninsulated surface (R01). */
  eqVolumePerGlass_m3_per_m2: { value: number; source: Source };
  eqVolumePerUninsulated_m3_per_m2: { value: number; source: Source };
  /** Ceiling above the top bench (R03, warning). */
  topBenchToCeiling_mm: { min: Mm; max: Mm; source: Source };
  doorMinClearWidth_mm: { value: Mm; source: Source };
  /** Opening wider than N slots → reinforcement frame (R07). */
  maxOpeningSlotsWithoutReinforcement: Record<ModuleType, { value: number; source: Source }>;
  /** Lifting-point reaction spread warning (0.25 = 25 %). */
  liftReactionSpreadWarn: { value: Ratio; source: Source };
  transport: {
    maxWidth_mm: { value: Mm; source: Source };
    maxHeightOnVehicle_mm: { value: Mm; source: Source };
    vehicles: Array<{ id: 'truck_hiab' | 'truck_crane'; maxMass_kg: Kg; deckHeight_mm: Mm; name: I18nText }>;
  };
  /** Gravity for kN outputs. */
  g_m_s2: number;
}

// -------------------------------------------------------------- catalog ---

export interface Catalog {
  tenantId: string;
  version: string;
  steel: SteelMaterial[];
  profiles: SteelProfile[];
  panels: PanelMaterial[];
  layups: Layup[];
  frameRecipes: FrameRecipe[];
  containers: ContainerShell[];
  openings: OpeningProduct[];
  heaters: Heater[];
  benchSystems: BenchSystem[];
  purchased: PurchasedPart[];
  attachmentSystems: AttachmentSystem[];
  electrical: ElectricalRow[];
  rules: RuleDef[];
  limits: Limits;
  rates: Rates;
}

export type CatalogItem =
  | SteelMaterial
  | SteelProfile
  | PanelMaterial
  | Layup
  | FrameRecipe
  | ContainerShell
  | OpeningProduct
  | Heater
  | BenchSystem
  | PurchasedPart
  | AttachmentSystem;

/** Fast lookup built once per evaluation. Throws on unknown SKU. */
export interface CatalogIndex {
  catalog: Catalog;
  get<K extends CatalogItem['kind']>(kind: K, sku: SkuRef): Extract<CatalogItem, { kind: K }>;
  find<K extends CatalogItem['kind']>(kind: K, sku: SkuRef): Extract<CatalogItem, { kind: K }> | undefined;
}

/** Public catalog (GET /tenants/:slug/public). Cost fields are stripped at runtime (M4). */
export type PublicCatalog = Omit<Catalog, 'rates'> & { rates: Pick<Rates, 'priceDisplay' | 'priceRange' | 'eurPerCzk'> };
