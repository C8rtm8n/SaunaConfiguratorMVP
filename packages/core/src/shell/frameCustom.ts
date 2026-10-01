import type { BomLine } from '../model/bom.js';
import type { FrameMemberRole } from '../model/catalog.js';
import type { BuildContext, BuildResult } from '../model/component.js';
import type { ExteriorWallId } from '../model/config.js';
import type { ExtrudeNode, SceneNode } from '../model/scene.js';
import type { Mm, Vec3 } from '../model/units.js';
import { purchasedLine, steelLine } from '../bom/lines.js';
import { frameRecipe } from '../geometry/module.js';
import { placedOpenings } from '../geometry/openings.js';
import { boxNode, group, sectionOf, sectionSize } from '../geometry/scene.js';
import { EXTERIOR_WALLS, wallFrame } from '../geometry/walls.js';

export const FRAME_ID = 'frame';

interface Member {
  role: FrameMemberRole;
  from: Vec3;
  to: Vec3;
}

/** Evenly spaced interior positions on (a, b) with spacing ≤ max. */
export function evenPositions(a: Mm, b: Mm, max: Mm): Mm[] {
  const n = Math.ceil((b - a) / max - 1e-9);
  const out: Mm[] = [];
  for (let i = 1; i < n; i++) out.push(a + ((b - a) * i) / n);
  return out;
}

/**
 * Grid column centres on one wall (D-016): both sides of every opening (outside
 * the rough opening); remaining gaps longer than maxSpacing are split evenly.
 * An ideal position inside an opening moves to the nearest free slot boundary;
 * if there is none, the gap stays open (bridged by the R07 reinforcement).
 */
export function gridColumnPositions(ctx: BuildContext, wall: ExteriorWallId, cornerA: Mm, cornerB: Mm, colW: Mm, maxSpacing: Mm): Mm[] {
  const openings = placedOpenings(ctx).filter((p) => p.opening.wall === wall);
  const blocked = openings.map((p) => [p.along[0] - colW / 2, p.along[1] + colW / 2] as const);
  const isBlocked = (x: Mm) => blocked.some(([a, b]) => x > a + 1e-6 && x < b - 1e-6);
  const req: Mm[] = [];
  for (const p of openings) {
    for (const x of [p.along[0] - colW / 2, p.along[1] + colW / 2]) {
      if (x - cornerA >= colW && cornerB - x >= colW) req.push(x);
    }
  }
  const lay = ctx.slots[wall]!;
  const boundaries = [...new Set(lay.slots.flatMap((s) => [s.from_mm, s.to_mm]))];
  const fixed = [cornerA, ...req, cornerB].sort((a, b) => a - b);
  const out: Mm[] = [...req];
  for (let i = 1; i < fixed.length; i++) {
    const a = fixed[i - 1]!;
    const b = fixed[i]!;
    if (openings.some((p) => p.along[0] >= a - 1e-6 && p.along[1] <= b + 1e-6 && b - a <= p.along[1] - p.along[0] + 2 * colW + 1e-6)) continue;
    const n = Math.ceil((b - a) / maxSpacing - 1e-9);
    for (let k = 1; k < n; k++) {
      const ideal = a + ((b - a) * k) / n;
      if (!isBlocked(ideal)) {
        out.push(ideal);
        continue;
      }
      const alt = boundaries
        .filter((x) => x - a >= colW && b - x >= colW && !isBlocked(x))
        .sort((x, y) => Math.abs(x - ideal) - Math.abs(y - ideal) || x - y)[0];
      if (alt !== undefined) out.push(alt);
    }
  }
  const uniq: Mm[] = [];
  for (const x of out.sort((a, b) => a - b)) if (!uniq.some((u) => Math.abs(u - x) < 1)) uniq.push(x);
  return uniq;
}

export function buildCustomFrame(_params: unknown, ctx: BuildContext): BuildResult {
  const recipe = frameRecipe(ctx.config, ctx.catalog);
  const S = ctx.geo.structure;
  const prof = (role: FrameMemberRole) => {
    const m = recipe.members[role];
    if (!m) throw new Error(`frame recipe ${recipe.sku}: missing role ${role}`);
    const p = ctx.catalog.get('steel_profile', m.profile);
    return { sku: p.sku, size: sectionSize(p.section), section: sectionOf(p.section), maxSpacing: m.maxSpacing_mm };
  };
  const base = prof('base_perimeter');
  const cross = prof('base_crossmember');
  const corner = prof('column_corner');
  const gridCol = prof('column_grid');
  const top = prof('top_perimeter');
  const roofBeam = prof('roof_beam');

  const [x0, y0, z0] = S.min;
  const [x1, y1, z1] = S.max;
  const members: Member[] = [];
  const push = (role: FrameMemberRole, from: Vec3, to: Vec3) => members.push({ role, from, to });

  // Base frame: longitudinals full length, transverse ends between them.
  const bu = base.size.u;
  const zb = z0 + base.size.v / 2;
  push('base_perimeter', [x0, y0 + bu / 2, zb], [x1, y0 + bu / 2, zb]);
  push('base_perimeter', [x0, y1 - bu / 2, zb], [x1, y1 - bu / 2, zb]);
  push('base_perimeter', [x0 + bu / 2, y0 + bu, zb], [x0 + bu / 2, y1 - bu, zb]);
  push('base_perimeter', [x1 - bu / 2, y0 + bu, zb], [x1 - bu / 2, y1 - bu, zb]);
  const zc = z0 + base.size.v - cross.size.v / 2; // flush top
  for (const x of evenPositions(x0 + bu, x1 - bu, cross.maxSpacing ?? Infinity)) {
    push('base_crossmember', [x, y0 + bu, zc], [x, y1 - bu, zc]);
  }

  // Top frame.
  const tu = top.size.u;
  const zt = z1 - top.size.v / 2;
  push('top_perimeter', [x0, y0 + tu / 2, zt], [x1, y0 + tu / 2, zt]);
  push('top_perimeter', [x0, y1 - tu / 2, zt], [x1, y1 - tu / 2, zt]);
  push('top_perimeter', [x0 + tu / 2, y0 + tu, zt], [x0 + tu / 2, y1 - tu, zt]);
  push('top_perimeter', [x1 - tu / 2, y0 + tu, zt], [x1 - tu / 2, y1 - tu, zt]);
  const zr = z1 - roofBeam.size.v / 2;
  for (const x of evenPositions(x0 + tu, x1 - tu, roofBeam.maxSpacing ?? Infinity)) {
    push('roof_beam', [x, y0 + tu, zr], [x, y1 - tu, zr]);
  }

  // Columns between base and top frame.
  const cz0 = z0 + base.size.v;
  const cz1 = z1 - top.size.v;
  const cw = corner.size.u;
  const cornersXY: Array<[Mm, Mm]> = [
    [x0 + cw / 2, y0 + cw / 2],
    [x1 - cw / 2, y0 + cw / 2],
    [x1 - cw / 2, y1 - cw / 2],
    [x0 + cw / 2, y1 - cw / 2],
  ];
  for (const [x, y] of cornersXY) push('column_corner', [x, y, cz0], [x, y, cz1]);
  for (const w of EXTERIOR_WALLS) {
    const f = wallFrame(w);
    const line = { S: y0 + cw / 2, N: y1 - cw / 2, W: x0 + cw / 2, E: x1 - cw / 2 }[w];
    const a = S.min[f.axis] + cw / 2;
    const b = S.max[f.axis] - cw / 2;
    for (const p of gridColumnPositions(ctx, w, a, b, gridCol.size.u, gridCol.maxSpacing ?? Infinity)) {
      const xy: [Mm, Mm] = f.axis === 0 ? [p, line] : [line, p];
      push('column_grid', [xy[0], xy[1], cz0], [xy[0], xy[1], cz1]);
    }
  }

  const bom: BomLine[] = [];
  const nodes: SceneNode[] = [];
  const profByRole = { base_perimeter: base, base_crossmember: cross, column_corner: corner, column_grid: gridCol, top_perimeter: top, roof_beam: roofBeam } as const;
  members.forEach((m, i) => {
    const p = profByRole[m.role as keyof typeof profByRole];
    const len = Math.abs(m.to[0] - m.from[0]) + Math.abs(m.to[1] - m.from[1]) + Math.abs(m.to[2] - m.from[2]);
    const cog: Vec3 = [(m.from[0] + m.to[0]) / 2, (m.from[1] + m.to[1]) / 2, (m.from[2] + m.to[2]) / 2];
    bom.push(steelLine(ctx, { componentId: FRAME_ID, assembly: 'frame', cog }, p.sku, len, 1));
    const n: ExtrudeNode = { type: 'extrude', id: `${FRAME_ID}/${m.role}/${i}`, section: p.section, from: m.from, to: m.to, material: 'steel' };
    nodes.push(n);
  });

  if (recipe.liftingLug) {
    liftingPoints(ctx).forEach((pt, i) => {
      bom.push(purchasedLine(ctx, { componentId: FRAME_ID, assembly: 'frame', cog: pt }, recipe.liftingLug!, 1));
      nodes.push(boxNode(`${FRAME_ID}/lug/${i}`, { min: [pt[0] - 30, pt[1] - 10, pt[2]], max: [pt[0] + 30, pt[1] + 10, pt[2] + 80] }, 'steel'));
    });
  }
  return { geometry: group(FRAME_ID, nodes), bom, penetrations: [] };
}

/** Lifting points A..D (A = x min / y min, counter-clockwise from above). */
export function liftingPoints(ctx: BuildContext): Vec3[] {
  const S = ctx.geo.structure;
  let inset: Mm;
  if (ctx.config.module.type === 'custom_frame') {
    const col = frameRecipe(ctx.config, ctx.catalog).members.column_corner!;
    inset = sectionSize(ctx.catalog.get('steel_profile', col.profile).section).u / 2;
  } else {
    inset = ctx.catalog.all('container').find((c) => c.L_mm === ctx.config.module.L_mm)!.cornerPost_mm / 2;
  }
  const z = S.max[2];
  return [
    [S.min[0] + inset, S.min[1] + inset, z],
    [S.max[0] - inset, S.min[1] + inset, z],
    [S.max[0] - inset, S.max[1] - inset, z],
    [S.min[0] + inset, S.max[1] - inset, z],
  ];
}
