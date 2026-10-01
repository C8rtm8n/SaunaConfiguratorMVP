import type { ExteriorWallId, WallId } from './config.js';
import type { Id, Mm, Vec2, Vec3 } from './units.js';

/**
 * Abstract scene description produced by core builders. Not Three.js.
 * The viewer maps it 1:1; it never adds or edits geometry on its own.
 */

export interface Transform {
  /** Translation in parent coordinates [mm]. */
  position: Vec3;
  /** Euler XYZ [rad]. */
  rotation?: Vec3;
}

/** Hints for viewer behaviour (section mode, picking, LOD). */
export interface NodeTags {
  /** Hidden in section mode ('roof', 'wall:S'). */
  cutaway?: 'roof' | `wall:${ExteriorWallId}`;
  /** Clicking selects this slot (opening picker). */
  slot?: { wall: WallId | 'roof'; index: number };
  castShadow?: boolean;
}

interface NodeBase {
  /** Stable id: `${componentId}/${localName}`. Used by the viewer to diff. */
  id: Id;
  transform?: Transform;
  /** Viewer material id (PBR set), from catalog `appearance`. */
  material?: string;
  tags?: NodeTags;
}

export interface GroupNode extends NodeBase {
  type: 'group';
  /** Content hash of the subtree; unchanged hash → viewer keeps the objects. */
  hash: string;
  children: SceneNode[];
}

/** Axis-aligned box, origin at its min corner in local coordinates. */
export interface BoxNode extends NodeBase {
  type: 'box';
  size: Vec3;
}

/** 2D section (outer contour + holes, CCW) in the local UV plane. */
export interface Section2D {
  outer: Vec2[];
  holes?: Vec2[][];
}

/** Straight prismatic member: section extruded from `from` to `to`. */
export interface ExtrudeNode extends NodeBase {
  type: 'extrude';
  section: Section2D;
  from: Vec3;
  to: Vec3;
  /** Rotation of the section around the member axis [rad]. */
  roll?: number;
}

/** Many copies of one geometry (lamellas, bench boards, frame members). */
export interface InstancesNode extends NodeBase {
  type: 'instances';
  base: BoxNode | ExtrudeNode;
  instances: Transform[];
}

/** Planar panel with rectangular holes (wall panel with opening cut-out). */
export interface PanelNode extends NodeBase {
  type: 'panel';
  /** Panel size in its local XY plane, thickness along local Z. */
  width_mm: Mm;
  height_mm: Mm;
  thickness_mm: Mm;
  holes?: Array<{ u: Mm; v: Mm; w: Mm; h: Mm }>;
}

/** Reference to a GLB asset (heater, door leaf, light, chimney). */
export interface AssetNode extends NodeBase {
  type: 'asset';
  asset: string;
  /** Uniform scale; assets are authored in mm. */
  scale?: number;
}

export type SceneNode = GroupNode | BoxNode | ExtrudeNode | InstancesNode | PanelNode | AssetNode;
