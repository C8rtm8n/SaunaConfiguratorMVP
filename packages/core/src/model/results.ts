import type { AssemblyId, BomLine, BomRow } from './bom.js';
import type { ModuleGeometry, Penetration } from './component.js';
import type { PriceDisplayMode } from './catalog.js';
import type { Config } from './config.js';
import type { AutoAddition, Facts, Violation } from './rules.js';
import type { GroupNode } from './scene.js';
import type { SlotMap } from './slots.js';
import type { Czk, Kg, Kn, Kw, M3, Mm, Ratio, SkuRef, Vec3 } from './units.js';

export interface MassReport {
  byAssembly: Partial<Record<AssemblyId, { mass_kg: Kg; cog_mm: Vec3 }>>;
  /** Complete installed module incl. demounted parts, excl. foundation. */
  empty_kg: Kg;
  empty_cog_mm: Vec3;
  /** Without lines with transport = 'demounted' (and without foundation). */
  transport_kg: Kg;
  transport_cog_mm: Vec3;
  /** Foundation parts (pads, screws, skids) – listed, not part of the module. */
  foundation_kg: Kg;
  demounted: Array<{ assembly: AssemblyId; mass_kg: Kg }>;
}

/** Reaction at a support / lifting point. */
export interface PointReaction {
  id: string;
  position_mm: Vec3;
  R_kN: Kn;
}

export interface LiftReactions {
  /** Points A..D at the 4 top corners (A = x min/y min, then counter-clockwise). */
  points: PointReaction[];
  /** D-010: rigid body on equally stiff vertical supports (planar reaction field). */
  method: 'rigid_equal_stiffness';
  load_kN: Kn;
  /** (Rmax − Rmin) / Rmean. */
  spread: Ratio;
  warn: boolean;
}

export interface SupportLoads {
  foundation: Config['foundation'];
  method: 'rigid_equal_stiffness';
  /** Self weight of the installed module without own-supported attachments. No live / snow load. */
  load_kN: Kn;
  cog_mm: Vec3;
  points: PointReaction[];
}

export interface TransportReport {
  width_mm: Mm;
  length_mm: Mm;
  height_mm: Mm;
  vehicleId: string;
  deckHeight_mm: Mm;
  heightOnVehicle_mm: Mm;
  needsMobileCrane: boolean;
  oversize: boolean;
  oversizeReasons: Array<'width' | 'height' | 'mass'>;
  mass_kg: Kg;
  demountedParts: SkuRef[];
}

export interface SaunaReport {
  innerVolume_m3: M3;
  glassArea_m2: number;
  uninsulatedArea_m2: number;
  eqVolume_m3: M3;
  /** Heaters whose min–max range contains eqVolume (R01); UI offers only these. */
  suitableHeaters: SkuRef[];
  cabinClearHeight_mm: Mm;
  topBench_mm: Mm;
  topBenchToCeiling_mm: Mm;
  electrical?: { power_kw: Kw; voltage: 230 | 400; breaker_A: number; cable: string };
}

export interface PriceBreakdown {
  /** Costs (admin only; stripped from public responses). */
  cost: { steel: Czk; timber: Czk; purchased: Czk; labour: Czk; transport: Czk; crane: Czk; total: Czk };
  /** Sell price per category and total, excl. VAT. */
  price: { steel: Czk; timber: Czk; purchased: Czk; labour: Czk; transport: Czk; crane: Czk; total: Czk };
  total: Czk;
  display:
    | { mode: Extract<PriceDisplayMode, 'hidden'> }
    | { mode: Extract<PriceDisplayMode, 'range'>; from: Czk; to: Czk }
    | { mode: Extract<PriceDisplayMode, 'exact'>; value: Czk };
}

export const EVALUATION_SCHEMA_VERSION = 1 as const;

/** Everything derived from (config, catalog). Same on client and server. */
export interface Evaluation {
  schemaVersion: typeof EVALUATION_SCHEMA_VERSION;
  config: Config;
  catalogVersion: string;
  geometry: ModuleGeometry;
  auto: AutoAddition[];
  slots: SlotMap;
  scene: GroupNode;
  bom: BomLine[];
  bomRows: BomRow[];
  penetrations: Penetration[];
  mass: MassReport;
  lift: LiftReactions;
  supports: SupportLoads;
  transport: TransportReport;
  sauna: SaunaReport;
  price: PriceBreakdown;
  facts: Facts;
  violations: Violation[];
  /** No 'error' violations → may be submitted as a lead. */
  submittable: boolean;
}
