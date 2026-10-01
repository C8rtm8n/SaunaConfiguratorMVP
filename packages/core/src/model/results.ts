import type { AssemblyId, BomLine, BomRow } from './bom.js';
import type { Penetration } from './component.js';
import type { PriceDisplayMode } from './catalog.js';
import type { Config } from './config.js';
import type { AutoAddition, Violation } from './rules.js';
import type { SceneNode } from './scene.js';
import type { SlotMap } from './slots.js';
import type { Czk, Kg, Kn, Kw, M3, Mm, Ratio, SkuRef, Vec3 } from './units.js';

export interface MassReport {
  byAssembly: Partial<Record<AssemblyId, { mass_kg: Kg; cog_mm: Vec3 }>>;
  /** Complete installed module incl. demounted parts. */
  empty_kg: Kg;
  empty_cog_mm: Vec3;
  /** Without lines with transport = 'demounted'. */
  transport_kg: Kg;
  transport_cog_mm: Vec3;
  demounted: Array<{ assembly: AssemblyId; mass_kg: Kg }>;
}

export interface LiftReactions {
  /** Points A..D at the 4 top corners (or catalog lifting points). */
  points: Array<{ id: 'A' | 'B' | 'C' | 'D'; position_mm: Vec3; R_kN: Kn }>;
  /** Assumption used (D-010, needs your confirmation). */
  method: 'rigid_equal_stiffness' | 'bilinear';
  /** (Rmax − Rmin) / Rmean. */
  spread: Ratio;
  warn: boolean;
}

export interface SupportLoads {
  foundation: Config['foundation'];
  points: Array<{ id: string; position_mm: Vec3; R_kN: Kn }>;
}

export interface TransportReport {
  width_mm: Mm;
  vehicleId: string;
  heightOnVehicle_mm: Mm;
  oversize: boolean;
  oversizeReasons: Array<'width' | 'height'>;
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
  topBenchToCeiling_mm: Mm;
  electrical?: { power_kw: Kw; voltage: 230 | 400; breaker_A: number; cable: string };
}

export interface PriceBreakdown {
  /** Costs (admin only; stripped from public responses). */
  cost: { steel: Czk; timber: Czk; purchased: Czk; labour: Czk; transport: Czk; crane: Czk; total: Czk };
  /** Sell price excl. VAT. */
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
  auto: AutoAddition[];
  slots: SlotMap;
  scene: SceneNode;
  bom: BomLine[];
  bomRows: BomRow[];
  penetrations: Penetration[];
  mass: MassReport;
  lift: LiftReactions;
  supports: SupportLoads;
  transport: TransportReport;
  sauna: SaunaReport;
  price: PriceBreakdown;
  violations: Violation[];
  /** No 'error' violations → may be submitted as a lead. */
  submittable: boolean;
}
