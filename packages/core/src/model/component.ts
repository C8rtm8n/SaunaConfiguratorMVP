import type { BomLine } from './bom.js';
import type { CatalogIndex } from './catalog.js';
import type { Config, WallId } from './config.js';
import type { AutoAddition } from './rules.js';
import type { SceneNode } from './scene.js';
import type { SlotMap } from './slots.js';
import type { Id, Mm, Vec3 } from './units.js';

/**
 * Component builder: build(params, ctx) => { geometry, bom, penetrations }.
 * Pure and deterministic; the same function feeds 3D and BOM, so they cannot diverge.
 */

export type PenetrationKind =
  | 'flue'
  | 'vent_supply'
  | 'vent_exhaust'
  | 'electrical'
  | 'lifting_point';

export interface Penetration {
  id: Id;
  componentId: Id;
  kind: PenetrationKind;
  surface: WallId | 'roof' | 'floor';
  /** Centre in module coordinates. */
  position_mm: Vec3;
  size: { diameter_mm: Mm } | { w_mm: Mm; h_mm: Mm };
}

/** Anchor for attachments (terrace beams, overhang brackets, stair stringers). */
export interface AnchorPoint {
  id: Id;
  wall: WallId;
  position_mm: Vec3;
  kind: 'terrace' | 'overhang' | 'stairs';
}

export interface BuildResult {
  geometry: SceneNode;
  bom: BomLine[];
  penetrations: Penetration[];
  anchors?: AnchorPoint[];
}

/** Inner geometry derived once from module + layups (inner faces, clear height…). */
export interface ModuleGeometry {
  outer: Vec3;
  /** Inner clear box (after wall/roof/floor layups) [min, max]. */
  inner: { min: Vec3; max: Vec3 };
  wallThickness_mm: Mm;
  roofThickness_mm: Mm;
  floorThickness_mm: Mm;
}

export interface BuildContext {
  config: Config;
  catalog: CatalogIndex;
  slots: SlotMap;
  geometry: ModuleGeometry;
  auto: AutoAddition[];
}

export type ComponentBuilder<P = unknown> = (params: P, ctx: BuildContext) => BuildResult;

/** Node of the component list derived from config; `id` is stable across edits. */
export interface ComponentInstance<P = unknown> {
  id: Id;
  /** Registered builder name, e.g. 'frame.custom', 'wall.panel', 'opening', 'sauna.benches'. */
  builder: string;
  params: P;
}
