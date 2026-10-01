import type { Kn, Mm, Vec3 } from '../model/units.js';

/**
 * D-010 (approved, variant a): rigid body on n equally stiff vertical supports.
 * Support settlements are planar, so reactions are linear in (x, y):
 *   R_i = G/n + b·(x_i − x̄) + c·(y_i − ȳ)
 * with b, c from the moment equilibrium about the support centroid:
 *   [Σdx²  Σdxdy] [b]   [G·(x_T − x̄)]
 *   [Σdxdy Σdy² ] [c] = [G·(y_T − ȳ)]
 * For 4 corner points of a rectangle this reduces to
 *   R_i = G·[1/4 + (x_T − x̄)(x_i − x̄)/Σdx² + (y_T − ȳ)(y_i − ȳ)/Σdy²].
 * Negative R = uplift (support would have to pull).
 */
export function rigidReactions(points: ReadonlyArray<readonly [Mm, Mm]>, G: Kn, cog: Vec3): Kn[] {
  const n = points.length;
  const xm = points.reduce((s, p) => s + p[0], 0) / n;
  const ym = points.reduce((s, p) => s + p[1], 0) / n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const [x, y] of points) {
    sxx += (x - xm) ** 2;
    syy += (y - ym) ** 2;
    sxy += (x - xm) * (y - ym);
  }
  const mx = G * (cog[0] - xm);
  const my = G * (cog[1] - ym);
  const det = sxx * syy - sxy * sxy;
  let b = 0;
  let c = 0;
  if (Math.abs(det) > 1e-9) {
    b = (mx * syy - my * sxy) / det;
    c = (my * sxx - mx * sxy) / det;
  } else if (sxx > 1e-9) {
    b = mx / sxx; // supports on a line parallel to X
  } else if (syy > 1e-9) {
    c = my / syy;
  }
  return points.map(([x, y]) => G / n + b * (x - xm) + c * (y - ym));
}

/** (Rmax − Rmin) / Rmean. */
export function spread(r: readonly number[]): number {
  const mean = r.reduce((s, v) => s + v, 0) / r.length;
  return mean === 0 ? 0 : (Math.max(...r) - Math.min(...r)) / mean;
}
