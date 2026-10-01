import type { BomLine } from './bom.js';
import type { CatalogIndex } from './catalog.js';
import type { Config, PartitionId, WallId } from './config.js';
import type { AutoAddition } from './rules.js';
import type { SceneNode } from './scene.js';
import type { SlotMap } from './slots.js';
import type { Id, Mm, Vec3 } from './units.js';

/**
 * Component builder: build(params, ctx) => { geometry, bom, penetrations }.
 * Pure and deterministic; the same function feeds 3D and BOM, so they cannot diverge.
 */

export type PenetrationKind = 'flue' | 'vent_supply' | 'vent_exhaust' | 'electrical';

export interface Penetration {
  id: Id;
  componentId: Id;
  kind: PenetrationKind;
  surface: WallId | 'roof' | 'floor';
  /** Centre in module coordinates. */
  position_mm: Vec3;
  size: { diameter_mm: Mm } | { w_mm: Mm; h_mm: Mm };
}

export interface BuildResult {
  geometry: SceneNode;
  bom: BomLine[];
  penetrations: Penetration[];
}

export interface Box3 {
  min: Vec3;
  max: Vec3;
}

export interface ResolvedLayer {
  kind: 'panel' | 'members' | 'air' | 'structure';
  /** Resolved SKU (tokens like '$exterior' replaced). */
  sku?: string;
  fill?: string;
  thickness_mm: Mm;
  spacing_mm?: Mm;
  /** Distance of the layer's outer face from the outer face of the build-up. */
  offset_mm: Mm;
}

export interface ResolvedLayup {
  sku: string;
  layers: ResolvedLayer[];
  /** Thickness outside the structure layer. */
  ext_mm: Mm;
  structure_mm: Mm;
  /** Thickness inside the structure layer. */
  int_mm: Mm;
  total_mm: Mm;
  insulated: boolean;
}

/** Interior room of one zone. */
export interface Room {
  zoneId: Id;
  zoneType: string;
  /** Clear inner box (finished surfaces). */
  box: Box3;
  /** Walls bounding the room: long walls S/N and the X-ends (exterior or partition). */
  walls: { S: WallId; N: WallId; west: WallId; east: WallId };
}

/** Derived once from module + layups (D-013). */
export interface ModuleGeometry {
  /** Finished outer faces (cladding). */
  envelope: Box3;
  /** Outer faces of the load-bearing structure (steel frame / container). */
  structure: Box3;
  /** Clear inner box (finished interior faces), whole module. */
  inner: Box3;
  layups: { wall: ResolvedLayup; roof: ResolvedLayup; floor: ResolvedLayup; partition: ResolvedLayup };
  partitions: Array<{ id: PartitionId; x_mm: Mm; thickness_mm: Mm }>;
  rooms: Room[];
}

export interface BuildContext {
  config: Config;
  catalog: CatalogIndex;
  slots: SlotMap;
  geo: ModuleGeometry;
  auto: AutoAddition[];
}

export type ComponentBuilder<P = any> = (params: P, ctx: BuildContext) => BuildResult;

/** Node of the component list derived from config; `id` is stable across edits. */
export interface ComponentInstance<P = unknown> {
  id: Id;
  /** Registered builder name, e.g. 'frame.custom', 'shell.wall', 'opening', 'sauna.benches'. */
  builder: string;
  params: P;
}
