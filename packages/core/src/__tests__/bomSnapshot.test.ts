import { describe, expect, it } from 'vitest';
import { REFERENCE_CONFIGS } from '../fixtures/referenceConfigs.js';
import { round } from '../util/math.js';
import { run } from './helpers.js';

/** Snapshot of aggregated BOM + mass summary for the 3 reference configs. */
describe('BOM snapshots', () => {
  it.each(Object.entries(REFERENCE_CONFIGS))('%s', (_name, cfg) => {
    const e = run(cfg);
    const rows = e.bomRows.map((r) => ({
      pos: r.pos,
      assembly: r.assembly,
      sku: r.sku,
      ...(r.profile ? { profile: r.profile } : {}),
      ...(r.len_mm ? { len_mm: round(r.len_mm, 1) } : {}),
      qty: round(r.qty, 3),
      unit: r.unit,
      mass_kg: round(r.mass_kg, 2),
      cost: round(r.cost, 0),
      transport: r.transport,
    }));
    expect(rows).toMatchSnapshot();
    expect({
      empty_kg: round(e.mass.empty_kg, 1),
      transport_kg: round(e.mass.transport_kg, 1),
      cog: e.mass.transport_cog_mm.map((v) => round(v, 0)),
      lift_kN: e.lift.points.map((p) => round(p.R_kN, 2)),
      price_total: round(e.price.total, 0),
    }).toMatchSnapshot();
  });
});
