import type { ExteriorWallId, WallId } from './config.js';
import type { Id, Mm, Vec2, Vec3 } from './units.js';

/**
 * Abstract scene description produced by core builders. Not Three.js.
 * The viewer maps it 1:1; it never adds or edits geometry on its own.
 * All coordinates are module coordinates [mm] (D-004). The module is
 * rectangular, so everything except assets is axis-aligned (D-014).
 */

/** Hints for viewer behaviour (section mode, picking, LOD). */
export interface NodeTags {
  /** Hidden in section mode. */
  cutaway?: 'roof' | `wall:${ExteriorWallId}`;
  /** Clicking selects this slot (opening picker). */
  slot?: { wall: WallId | 'roof'; index: number };
  castShadow?: boolean;
}

interface NodeBase {
  /** Stable id: `${componentId}/${localName}`. Used by the viewer to diff. */
  id: Id;
  /** Viewer material id (PBR set), from catalog `appearance` or a fixed id ('steel', 'glass'…). */
  material?: string;
  tags?: NodeTags;
}

export interface GroupNode extends NodeBase {
  type: 'group';
  /** Content hash of the subtree; unchanged hash → viewer keeps the objects. */
  hash: string;
  children: SceneNode[];
}

/** Axis-aligned box from `min` with `size`. */
export interface BoxNode extends NodeBase {
  type: 'box';
  min: Vec3;
  size: Vec3;
}

/** 2D section (outer contour + holes, CCW) in the member's local (u, v) plane, centred on the axis. */
export interface Section2D {
  outer: Vec2[];
  holes?: Vec2[][];
}

/**
 * Straight prismatic member, section extruded along an axis-parallel line from → to.
 * Local section axes (right-handed with the member axis, D-028):
 * member ∥ X → (u, v) = (Y, Z); ∥ Y → (−X, Z); ∥ Z → (X, Y).
 */
export interface ExtrudeNode extends NodeBase {
  type: 'extrude';
  section: Section2D;
  from: Vec3;
  to: Vec3;
  /** Section rotation around the member axis [rad], applied before placement. */
  roll?: number;
}

/** Round member (flue, legs). */
export interface CylinderNode extends NodeBase {
  type: 'cylinder';
  radius_mm: Mm;
  from: Vec3;
  to: Vec3;
}

/** Many copies of one box (lamellas, bench boards). Each instance = min corner. */
export interface InstancesNode extends NodeBase {
  type: 'instances';
  size: Vec3;
  instances: Vec3[];
}

/**
 * Axis-aligned planar panel with rectangular holes (wall panel with opening).
 * plane 'xz': u = X, v = Z, thickness +Y; 'yz': u = Y, v = Z, thickness +X; 'xy': u = X, v = Y, thickness +Z.
 */
export interface PanelNode extends NodeBase {
  type: 'panel';
  plane: 'xz' | 'yz' | 'xy';
  /** Min corner of the panel (incl. thickness direction). */
  min: Vec3;
  width_mm: Mm;
  height_mm: Mm;
  thickness_mm: Mm;
  /** Holes in local (u, v) relative to `min`. */
  holes?: Array<{ u: Mm; v: Mm; w: Mm; h: Mm }>;
  /**
   * Board joints of lamella cladding (D-029): joints repeat every `pitch_mm`
   * along local axis `along` ('u' = vertical boards side by side, 'v' = horizontal boards).
   */
  grain?: { along: 'u' | 'v'; pitch_mm: Mm };
}

/** Reference to a GLB asset placed into an axis-aligned bounding box. */
export interface AssetNode extends NodeBase {
  type: 'asset';
  asset: string;
  /** Box the asset is fitted into (fallback rendering = this box). */
  min: Vec3;
  size: Vec3;
  /** Rotation around Z [rad] (heater facing the room). */
  rotZ?: number;
}

export type SceneNode =
  | GroupNode
  | BoxNode
  | ExtrudeNode
  | CylinderNode
  | InstancesNode
  | PanelNode
  | AssetNode;
