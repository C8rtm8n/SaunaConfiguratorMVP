import type { Box3, ModuleGeometry } from '../model/component.js';
import type { ExteriorWallId, WallId } from '../model/config.js';
import type { Mm } from '../model/units.js';

/**
 * Wall frame helpers. "along" = module coordinate along the wall axis
 * (x for S/N, y for E/W/partitions); "normal" = axis perpendicular to the wall.
 */
export interface WallFrame {
  wall: WallId;
  axis: 0 | 1; // along axis index
  normalAxis: 0 | 1;
  /** +1 if the room interior lies in +normal direction from this wall. */
  inward: 1 | -1;
}

export const EXTERIOR_WALLS: readonly ExteriorWallId[] = ['S', 'N', 'W', 'E'];

export function isPartition(w: WallId): w is `P${number}` {
  return w.startsWith('P');
}

export function wallFrame(wall: WallId): WallFrame {
  switch (wall) {
    case 'S':
      return { wall, axis: 0, normalAxis: 1, inward: 1 };
    case 'N':
      return { wall, axis: 0, normalAxis: 1, inward: -1 };
    case 'W':
      return { wall, axis: 1, normalAxis: 0, inward: 1 };
    case 'E':
      return { wall, axis: 1, normalAxis: 0, inward: -1 };
    default:
      // Partition: orientation relative to a room is resolved by roomWallFace.
      return { wall, axis: 1, normalAxis: 0, inward: 1 };
  }
}

/** Opposite exterior wall. */
export function oppositeWall(w: ExteriorWallId): ExteriorWallId {
  return ({ S: 'N', N: 'S', W: 'E', E: 'W' } as const)[w];
}

/** Inner face of a wall as seen from a room box: plane coordinate and inward direction. */
export function roomWallFace(room: Box3, roomWalls: { S: WallId; N: WallId; west: WallId; east: WallId }, wall: WallId):
  | { normalAxis: 0 | 1; axis: 0 | 1; plane: Mm; inward: 1 | -1; along: [Mm, Mm] }
  | undefined {
  if (wall === roomWalls.S) return { normalAxis: 1, axis: 0, plane: room.min[1], inward: 1, along: [room.min[0], room.max[0]] };
  if (wall === roomWalls.N) return { normalAxis: 1, axis: 0, plane: room.max[1], inward: -1, along: [room.min[0], room.max[0]] };
  if (wall === roomWalls.west) return { normalAxis: 0, axis: 1, plane: room.min[0], inward: 1, along: [room.min[1], room.max[1]] };
  if (wall === roomWalls.east) return { normalAxis: 0, axis: 1, plane: room.max[0], inward: -1, along: [room.min[1], room.max[1]] };
  return undefined;
}

/** Outer plane coordinate of an exterior wall (envelope face). */
export function envelopePlane(geo: ModuleGeometry, w: ExteriorWallId): Mm {
  const e = geo.envelope;
  return { S: e.min[1], N: e.max[1], W: e.min[0], E: e.max[0] }[w];
}

/** Along-range [min, max] of an exterior wall on a given box. */
export function alongRange(b: Box3, w: WallId): [Mm, Mm] {
  const f = wallFrame(w);
  return [b.min[f.axis], b.max[f.axis]];
}
