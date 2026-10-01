import type { Box3 } from '../model/component.js';
import type { Vec3 } from '../model/units.js';

export const v3 = (x: number, y: number, z: number): Vec3 => [x, y, z];

export function box(min: Vec3, max: Vec3): Box3 {
  return { min, max };
}

export function boxFromMinSize(min: Vec3, size: Vec3): Box3 {
  return { min, max: [min[0] + size[0], min[1] + size[1], min[2] + size[2]] };
}

export function boxSize(b: Box3): Vec3 {
  return [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]];
}

export function boxCenter(b: Box3): Vec3 {
  return [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
}

export function boxInset(b: Box3, d: Vec3, dTop = d[2], dBottom = d[2]): Box3 {
  return {
    min: [b.min[0] + d[0], b.min[1] + d[1], b.min[2] + dBottom],
    max: [b.max[0] - d[0], b.max[1] - d[1], b.max[2] - dTop],
  };
}

/** Overlap with positive volume (touching faces do not count). */
export function boxesOverlap(a: Box3, b: Box3, eps = 1e-6): boolean {
  for (let i = 0; i < 3; i++) {
    if (a.max[i]! <= b.min[i]! + eps || b.max[i]! <= a.min[i]! + eps) return false;
  }
  return true;
}

/** a fully inside b (faces may touch). */
export function boxInside(a: Box3, b: Box3, eps = 1e-6): boolean {
  for (let i = 0; i < 3; i++) {
    if (a.min[i]! < b.min[i]! - eps || a.max[i]! > b.max[i]! + eps) return false;
  }
  return true;
}

export function sum(values: readonly number[]): number {
  let s = 0;
  for (const v of values) s += v;
  return s;
}

/** Mass-weighted centre. Returns [0,0,0] for zero total mass. */
export function weightedCentre(items: ReadonlyArray<{ m: number; c: Vec3 }>): Vec3 {
  let m = 0;
  let x = 0;
  let y = 0;
  let z = 0;
  for (const it of items) {
    m += it.m;
    x += it.m * it.c[0];
    y += it.m * it.c[1];
    z += it.m * it.c[2];
  }
  return m === 0 ? [0, 0, 0] : [x / m, y / m, z / m];
}

/** Solve a 3×3 linear system by Cramer's rule. */
export function solve3(a: number[][], b: number[]): [number, number, number] {
  const det = (m: number[][]) =>
    m[0]![0]! * (m[1]![1]! * m[2]![2]! - m[1]![2]! * m[2]![1]!) -
    m[0]![1]! * (m[1]![0]! * m[2]![2]! - m[1]![2]! * m[2]![0]!) +
    m[0]![2]! * (m[1]![0]! * m[2]![1]! - m[1]![1]! * m[2]![0]!);
  const d = det(a);
  if (Math.abs(d) < 1e-12) throw new Error('solve3: singular matrix');
  const col = (i: number) => a.map((row, r) => row.map((v, c) => (c === i ? b[r]! : v)));
  return [det(col(0)) / d, det(col(1)) / d, det(col(2)) / d];
}

/** Round for presentation / snapshots only. */
export function round(v: number, digits = 3): number {
  const f = 10 ** digits;
  const r = Math.round(v * f) / f;
  return Object.is(r, -0) ? 0 : r;
}
