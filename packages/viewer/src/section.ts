import type { ExteriorWallId } from '@sauna/core';

/**
 * Section mode (D-031): hide the roof and the exterior wall facing the camera.
 * The front wall is the one whose outward normal points most towards the camera
 * (in plan, relative to the module centre), so the cut follows orbiting.
 */
export function frontWall(camera_mm: readonly [number, number], centre_mm: readonly [number, number], size_mm: readonly [number, number]): ExteriorWallId {
  // Normalise by half-size so that the diagonal from the centre to a corner is the switch line.
  const dx = (camera_mm[0] - centre_mm[0]) / (size_mm[0] / 2);
  const dy = (camera_mm[1] - centre_mm[1]) / (size_mm[1] / 2);
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'E' : 'W';
  return dy > 0 ? 'N' : 'S';
}

/** Whether an object with a cutaway tag is hidden in section mode. */
export function hiddenInSection(cutaway: string | undefined, front: ExteriorWallId): boolean {
  return cutaway === 'roof' || cutaway === `wall:${front}`;
}
