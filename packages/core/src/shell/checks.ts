import type { AutoFn, CheckFn } from '../model/productLine.js';
import type { ConfigPatchOp, Finding } from '../model/rules.js';
import { placeOpening } from '../geometry/openings.js';
import { isPartition, oppositeWall } from '../geometry/walls.js';
import { sideEdges } from './attachments.js';

const EPS = 1e-6;

/** S01: openings fit the slot system. */
const openingsValid: CheckFn = (ctx) => {
  const out: Finding[] = [];
  const grid = ctx.config.module.grid_mm;
  const occupied = new Map<string, string>();
  ctx.config.openings.forEach((o, i) => {
    const f = (variant: string, params: Finding['params'] = {}, patch?: ConfigPatchOp[]) => {
      const x: Finding = { variant, params: { opening: o.id, ...params }, affectedIds: [o.id] };
      if (patch) x.patch = patch;
      out.push(x);
    };
    const pr = ctx.catalog.find('opening', o.sku);
    const lay = ctx.slots[o.wall];
    if (!pr) return f('sku', { sku: o.sku });
    if (pr.type !== o.type) return f('type', { sku: o.sku, type: o.type });
    if (!pr.moduleTypes.includes(ctx.config.module.type)) return f('module', { sku: o.sku });
    if (!lay) return f('wall', { wall: o.wall });
    if (o.slotFrom < 0 || o.slotTo >= lay.slots.length || o.slotTo < o.slotFrom) return f('range', { slots: lay.slots.length });
    const n = o.slotTo - o.slotFrom + 1;
    if (pr.fullWall) {
      if (n !== lay.slots.length) return f('fullWall', { slots: lay.slots.length }, [
        { op: 'replace', path: `/openings/${i}/slotFrom`, value: 0 },
        { op: 'replace', path: `/openings/${i}/slotTo`, value: lay.slots.length - 1 },
      ]);
    } else {
      const need = pr.slots[grid];
      if (need === undefined) return f('grid', { grid_mm: grid });
      if (n !== need) {
        const patch: ConfigPatchOp[] | undefined = o.slotFrom + need - 1 < lay.slots.length ? [{ op: 'replace', path: `/openings/${i}/slotTo`, value: o.slotFrom + need - 1 }] : undefined;
        return f('slots', { required: need, actual: n }, patch);
      }
    }
    const p = placeOpening(ctx, o)!;
    if (p.along[0] < p.clearSpan[0] - EPS || p.along[1] > p.clearSpan[1] + EPS) f('fit', { width_mm: pr.width_mm, clear_mm: p.clearSpan[1] - p.clearSpan[0] });
    if (p.z[1] > ctx.geo.inner.max[2] + EPS) f('height', { height_mm: pr.height_mm });
    for (let s = o.slotFrom; s <= o.slotTo; s++) {
      const k = `${o.wall}:${s}`;
      const other = occupied.get(k);
      if (other) {
        f('overlap', { other });
        break;
      }
      occupied.set(k, o.id);
    }
    if (o.type === 'door' && !o.door) f('doorSpec', {}, [{ op: 'add', path: `/openings/${i}/door`, value: { hinge: 'left', swing: 'out' } }]);
    if (!isPartition(o.wall) && (o.wall === 'S' || o.wall === 'N')) {
      for (const part of ctx.geo.partitions) {
        if (p.along[0] < part.x_mm + part.thickness_mm / 2 && p.along[1] > part.x_mm - part.thickness_mm / 2) f('partition', { partition: part.id });
      }
    }
  });
  return out;
};

/** S02: zones contiguous, cover the module, boundaries on the grid, known types. */
const zonesValid: CheckFn = (ctx, _facts, params) => {
  const z = ctx.config.zones;
  const L = ctx.config.module.L_mm;
  const grid = ctx.config.module.grid_mm;
  const allowed = String(params['types'] ?? '').split(',').filter(Boolean);
  const out: Finding[] = [];
  const f = (variant: string, p: Finding['params'], ids: string[]) => out.push({ variant, params: p, affectedIds: ids });
  if (z.length === 0) {
    f('empty', {}, []);
    return out;
  }
  if (z[0]!.from_mm !== 0) f('start', { from_mm: z[0]!.from_mm }, [z[0]!.id]);
  if (z[z.length - 1]!.to_mm !== L) f('end', { to_mm: z[z.length - 1]!.to_mm, L_mm: L }, [z[z.length - 1]!.id]);
  z.forEach((zone, k) => {
    if (allowed.length && !allowed.includes(zone.type)) f('type', { zone: zone.id, type: zone.type }, [zone.id]);
    if (zone.to_mm <= zone.from_mm) f('length', { zone: zone.id }, [zone.id]);
    if (k > 0 && z[k - 1]!.to_mm !== zone.from_mm) f('gap', { zone: zone.id }, [zone.id]);
    if (k > 0 && zone.from_mm % grid !== 0) f('grid', { zone: zone.id, x_mm: zone.from_mm, grid_mm: grid }, [zone.id]);
  });
  return out;
};

/** S03: attachments reference valid systems, depths, terraces and edges. */
const attachmentsValid: CheckFn = (ctx) => {
  const out: Finding[] = [];
  const atts = ctx.config.attachments;
  for (const a of atts) {
    const f = (variant: string, p: Finding['params'] = {}) => out.push({ variant, params: { attachment: a.id, ...p }, affectedIds: [a.id] });
    const sys = ctx.catalog.find('attachment_system', a.sku);
    if (!sys || sys.type !== a.type) {
      f('sku', { sku: a.sku });
      continue;
    }
    if ((a.type === 'terrace' || a.type === 'roof_overhang') && sys.allowedDepths_mm && !sys.allowedDepths_mm.includes(a.depth_mm)) {
      f('depth', { depth_mm: a.depth_mm, allowed: sys.allowedDepths_mm.join(', ') });
    }
    if (a.type === 'terrace' && a.slotFrom !== undefined && a.slotTo !== undefined) {
      const lay = ctx.slots[a.wall]!;
      if (a.slotFrom < 0 || a.slotTo >= lay.slots.length || a.slotTo < a.slotFrom) f('range');
    }
    if (a.type === 'railing' || a.type === 'stairs') {
      const t = atts.find((x) => x.id === a.attachTo && x.type === 'terrace');
      const isWall = ['N', 'S', 'E', 'W'].includes(a.attachTo);
      if (!t && !(a.type === 'stairs' && isWall)) {
        f('ref', { ref: a.attachTo });
        continue;
      }
      if (t && t.type === 'terrace') {
        const allowedEdges = [t.wall, ...sideEdges(t.wall)];
        const edges = a.type === 'railing' ? a.edges : [a.edge];
        for (const e of edges) if (!allowedEdges.includes(e) || e === oppositeWall(t.wall)) f('edge', { edge: e });
      }
    }
  }
  return out;
};

/** M01: lifting reactions spread (warning). */
const liftSpread: CheckFn = (ctx, facts) => {
  const s = facts['lift.spread'];
  const lim = ctx.catalog.catalog.limits.liftReactionSpreadWarn.value;
  return typeof s === 'number' && s > lim ? [{ params: { spread_pct: Math.round(s * 100), limit_pct: Math.round(lim * 100) }, affectedIds: [] }] : [];
};

/** T01: oversize transport (warning). */
const transportOversize: CheckFn = (_ctx, facts) =>
  facts['transport.oversize'] === true
    ? [{ params: { width_mm: facts['transport.width_mm'] ?? null, height_mm: facts['transport.heightOnVehicle_mm'] ?? null }, affectedIds: [] }]
    : [];

export const SHELL_CHECKS: Record<string, CheckFn> = { openingsValid, zonesValid, attachmentsValid, liftSpread, transportOversize };

/** R07: reinforcement frame for openings wider than N slots (stricter for ISO). */
const openingReinforcement: AutoFn = (ctx) => {
  const limit = ctx.catalog.catalog.limits.maxOpeningSlotsWithoutReinforcement[ctx.config.module.type].value;
  const out = [];
  for (const o of ctx.config.openings) {
    if (isPartition(o.wall)) continue;
    const n = o.slotTo - o.slotFrom + 1;
    if (n <= limit || !placeOpening(ctx, o)) continue;
    out.push({
      components: [{ id: `reinf-${o.id}`, builder: 'shell.reinforcement', params: { openingId: o.id } }],
      note: { cs: 'Otvor {opening} ({slots} slotů > {limit}): doplněn výztužný rám.', de: 'Öffnung {opening} ({slots} Slots > {limit}): Verstärkungsrahmen ergänzt.', en: 'Opening {opening} ({slots} slots > {limit}): reinforcement frame added.' },
      params: { opening: o.id, slots: n, limit },
    });
  }
  return out;
};

export const SHELL_AUTOS: Record<string, AutoFn> = { openingReinforcement };
