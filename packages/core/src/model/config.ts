import type { Id, Mm, SkuRef } from './units.js';

/**
 * Configuration = the single source of truth. It stores only the customer's
 * intent. Everything derived (auto rules, BOM, mass, price, scene) is
 * computed deterministically by `evaluate(config, catalog)`.
 */
export const CONFIG_SCHEMA_VERSION = 1 as const;

export type ProductLineId = 'sauna'; // later: | 'fitness' | 'glamping' | 'pool'
export type ModuleType = 'custom_frame' | 'iso_20hc';
export type GridMm = 600 | 1200;

/**
 * Exterior walls by orientation in module coordinates (D-004):
 * S: y = 0 (long, "front"), N: y = W (long, back),
 * W: x = 0 (short end, left), E: x = L (short end, right).
 */
export type ExteriorWallId = 'N' | 'S' | 'E' | 'W';
/** Interior partition between zone k and k+1 (1-based), e.g. 'P1'. */
export type PartitionId = `P${number}`;
export type WallId = ExteriorWallId | PartitionId;

// ---------------------------------------------------------------- shell ---

export interface ModuleSpec {
  type: ModuleType;
  /** Outer dimensions. For ISO they are fixed and must equal the catalog container. */
  L_mm: Mm;
  W_mm: Mm;
  H_mm: Mm;
  grid_mm: GridMm;
}

export interface CladdingSpec {
  /** Exterior cladding panel (role 'exterior_cladding'). */
  exterior: SkuRef;
  orientation: 'vertical' | 'horizontal';
  /** Roof covering (role 'roof_covering'). */
  roof: SkuRef;
}

export type OpeningType = 'window' | 'panorama' | 'glass_front' | 'door' | 'vent';

export interface DoorSpec {
  /** Hinge side as seen from the side the door swings to. */
  hinge: 'left' | 'right';
  /**
   * 'out' = away from the zone that owns the door (sauna door → out of the sauna;
   * exterior door → to the outside). Rule R04 requires 'out' for the sauna door.
   */
  swing: 'out' | 'in';
}

export interface Opening {
  id: Id;
  wall: WallId;
  /** First occupied slot (0-based, inclusive). */
  slotFrom: number;
  /** Last occupied slot (inclusive). Width in slots = slotTo - slotFrom + 1. */
  slotTo: number;
  type: OpeningType;
  /** Catalog opening product; its `type` must match. */
  sku: SkuRef;
  /** Required when type === 'door'. */
  door?: DoorSpec;
}

/** Zone along X. Zones are contiguous, ordered, and cover the module length. */
export interface Zone<T extends string = SaunaZoneType> {
  id: Id;
  type: T;
  /** Start in module X [mm]. First zone starts at 0, last ends at module.L_mm. */
  from_mm: Mm;
  /** End in module X [mm]. Interior boundaries = partition axes, snapped to grid. */
  to_mm: Mm;
}

// ---------------------------------------------------------- attachments ---

interface AttachmentBase {
  id: Id;
}

export interface TerraceAttachment extends AttachmentBase {
  type: 'terrace';
  /** Wall the terrace is anchored to. Front = short end (E/W), side = long wall (N/S). */
  wall: ExteriorWallId;
  /** Projection from the wall [mm]. Allowed values from catalog terrace system. */
  depth_mm: Mm;
  /** Slot span along the wall; omitted = full wall length. */
  slotFrom?: number;
  slotTo?: number;
  /** Terrace system SKU (frame + decking + supports). */
  sku: SkuRef;
}

export interface RoofOverhangAttachment extends AttachmentBase {
  type: 'roof_overhang';
  wall: ExteriorWallId;
  depth_mm: Mm;
  sku: SkuRef;
}

export interface StairsAttachment extends AttachmentBase {
  type: 'stairs';
  /** Terrace id, or an exterior wall when stairs lead directly to a door. */
  attachTo: Id | ExteriorWallId;
  /** Edge of the terrace or slot index on the wall the stairs sit at. */
  edge: ExteriorWallId;
  slot: number;
  sku: SkuRef;
}

export interface RailingAttachment extends AttachmentBase {
  type: 'railing';
  /** Terrace id. */
  attachTo: Id;
  /** Terrace edges that get a railing (stair opening is cut out automatically). */
  edges: ExteriorWallId[];
  sku: SkuRef;
}

export type Attachment =
  | TerraceAttachment
  | RoofOverhangAttachment
  | StairsAttachment
  | RailingAttachment;

export type Foundation = 'pads' | 'screws' | 'beams';

/** Delivery site. Used for transport price; distance falls back to tenant default. */
export interface DeliverySpec {
  postalCode?: string;
  country?: 'CZ' | 'DE' | 'AT' | 'SK';
  /** Road distance from the workshop [km]; when known (admin / later geocoding). */
  distance_km?: number;
}

/** Shell part shared by all product lines. */
export interface ShellConfig {
  id: Id;
  revision: number;
  tenantId: Id;
  catalogVersion: string;
  schemaVersion: typeof CONFIG_SCHEMA_VERSION;
  module: ModuleSpec;
  cladding: CladdingSpec;
  openings: Opening[];
  attachments: Attachment[];
  foundation: Foundation;
  delivery?: DeliverySpec;
}

// ---------------------------------------------------------------- sauna ---

export type SaunaZoneType = 'sauna' | 'changing';

export interface HeaterPlacement {
  sku: SkuRef;
  /** Wall the heater stands against (inside the sauna zone). */
  wall: WallId;
  /**
   * Heater axis position along the wall, as a module coordinate [mm] (D-006):
   * x for N/S walls, y for E/W walls and partitions.
   */
  along_mm: Mm;
}

export interface BenchConfig {
  /** Bench system from the catalog: level heights/depths, board, substructure. */
  system: SkuRef;
  layout: 'straight' | 'L';
  levels: 2 | 3;
  /** Main bench wall. */
  wall: WallId;
  /** Return wall for the L layout (must be perpendicular to `wall`). */
  returnWall?: WallId;
  /** Length of the L return leg, measured from the front of the main bench [mm]. */
  returnLength_mm?: Mm;
  /** Bench extent along the main wall as module coordinates [mm]; omitted = full room. */
  from_mm?: Mm;
  to_mm?: Mm;
}

export interface LightingItem {
  sku: SkuRef;
  mount: 'under_bench' | 'backrest' | 'ceiling' | 'wall';
  qty: number;
}

export interface SaunaInterior {
  /** Zone of type 'sauna' this interior belongs to. */
  zoneId: Id;
  heater: HeaterPlacement;
  benches: BenchConfig;
  lighting: LightingItem[];
  interiorCladding: SkuRef;
}

export interface SaunaConfig extends ShellConfig {
  productLine: 'sauna';
  zones: Zone<SaunaZoneType>[];
  sauna: SaunaInterior;
}

/** Discriminated by `productLine`; future packs add their own variant. */
export type Config = SaunaConfig;
