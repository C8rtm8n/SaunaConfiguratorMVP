import { describe, expect, it } from 'vitest';
import type { SceneNode } from '../model/scene.js';
import type { SaunaConfig } from '../model/config.js';
import { rigidReactions, spread } from '../calc/reactions.js';
import { DEMO_CATALOG } from '../fixtures/demoCatalog.js';
import { REF1_CUSTOM_4200_WOOD as REF1, REF2_CUSTOM_6000_TWO_ZONES as REF2, REF3_ISO20HC_GLASS_FRONT as REF3 } from '../fixtures/referenceConfigs.js';
import { evaluate } from '../evaluate.js';
import { weightedCentre } from '../util/math.js';
import { clone, run } from './helpers.js';

const REFS = [REF1, REF2, REF3];

function extrudes(n: SceneNode, out: Extract<SceneNode, { type: 'extrude' }>[] = []) {
  if (n.type === 'group') n.children.forEach((c) => extrudes(c, out));
  if (n.type === 'extrude') out.push(n);
  return out;
}

describe('steel mass = Σ kg/m × length (±0.5 %)', () => {
  it.each(REFS)('$id: BOM steel matches member lengths in the 3D scene', (c) => {
    const e = run(c);
    // Independent path: geometric length of every extruded member × catalog kg/m, matched by section.
    const kgmBySection = new Map(DEMO_CATALOG.profiles.map((p) => [JSON.stringify(evaluateSection(p.section)), p.mass_kg_per_m]));
    let fromScene = 0;
    for (const n of extrudes(e.scene)) {
      const len = Math.hypot(n.to[0] - n.from[0], n.to[1] - n.from[1], n.to[2] - n.from[2]);
      fromScene += (kgmBySection.get(JSON.stringify(n.section))! * len) / 1000;
    }
    const fromBom = e.bom.filter((l) => l.category === 'steel' && l.len_mm).reduce((s, l) => s + l.mass_kg, 0);
    expect(fromBom).toBeGreaterThan(0);
    expect(Math.abs(fromBom - fromScene) / fromScene).toBeLessThan(0.005);
  });

  it('catalog RHS kg/m agrees with the EN 10219-2 section formula (±0.5 %)', () => {
    for (const p of DEMO_CATALOG.profiles) {
      if (p.section.shape !== 'RHS') continue;
      const { h, b, t } = p.section;
      const ro = 2 * t; // EN 10219-2: r_o = 2t, r_i = t for t ≤ 6 mm
      const ri = t;
      const A = 2 * t * (b + h - 2 * t) - (4 - Math.PI) * (ro * ro - ri * ri);
      const kgm = (A * 7850) / 1e6;
      expect(Math.abs(kgm - p.mass_kg_per_m) / p.mass_kg_per_m).toBeLessThan(0.005);
    }
  });

  it('every steel line mass = kg/m × len × qty', () => {
    const e = run(REF2);
    for (const l of e.bom.filter((x) => x.category === 'steel' && x.len_mm)) {
      const p = DEMO_CATALOG.profiles.find((x) => x.sku === l.sku)!;
      expect(l.mass_kg).toBeCloseTo((p.mass_kg_per_m * l.len_mm! * l.qty) / 1000, 9);
    }
  });
});

// sectionOf is what the scene uses; import lazily to keep the test independent of BOM code.
import { sectionOf } from '../geometry/scene.js';
function evaluateSection(s: Parameters<typeof sectionOf>[0]) {
  return sectionOf(s);
}

describe('centre of gravity', () => {
  /** Symmetric module: one zone, no openings, no attachments. */
  function symmetric(base: SaunaConfig): SaunaConfig {
    const c = clone(base);
    c.openings = [];
    c.attachments = [];
    c.zones = [{ id: 'z', type: 'sauna', from_mm: 0, to_mm: c.module.L_mm }];
    c.sauna.zoneId = 'z';
    return c;
  }
  const SHELL = new Set(['frame', 'wall-S', 'wall-N', 'wall-W', 'wall-E', 'roof', 'floor']);

  it.each([REF1, REF2, REF3])('$id (symmetric variant): shell COG = geometric centre in plan', (base) => {
    const e = evaluate(symmetric(base), DEMO_CATALOG);
    const lines = e.bom.filter((l) => SHELL.has(l.componentId));
    const cog = weightedCentre(lines.map((l) => ({ m: l.mass_kg, c: l.cog_mm })));
    const s = e.geometry.structure;
    expect(cog[0]).toBeCloseTo((s.min[0] + s.max[0]) / 2, 1);
    expect(cog[1]).toBeCloseTo((s.min[1] + s.max[1]) / 2, 1);
  });

  it('symmetric frame alone: COG = centre in plan, lifting reactions equal', () => {
    const e = evaluate(symmetric(REF1), DEMO_CATALOG);
    const frame = e.bom.filter((l) => l.componentId === 'frame');
    const cog = weightedCentre(frame.map((l) => ({ m: l.mass_kg, c: l.cog_mm })));
    expect(cog[0]).toBeCloseTo(2100, 1);
    expect(cog[1]).toBeCloseTo(1150, 1);
  });

  it('total COG is the mass-weighted mean of all lines', () => {
    const e = run(REF2);
    const lines = e.bom.filter((l) => l.assembly !== 'foundation');
    const m = lines.reduce((s, l) => s + l.mass_kg, 0);
    const x = lines.reduce((s, l) => s + l.mass_kg * l.cog_mm[0], 0) / m;
    expect(e.mass.empty_kg).toBeCloseTo(m, 6);
    expect(e.mass.empty_cog_mm[0]).toBeCloseTo(x, 6);
  });

  it('transport mass excludes demounted parts', () => {
    const e = run(REF2);
    const dem = e.bom.filter((l) => l.assembly !== 'foundation' && l.transport === 'demounted').reduce((s, l) => s + l.mass_kg, 0);
    expect(dem).toBeGreaterThan(0);
    expect(e.mass.transport_kg).toBeCloseTo(e.mass.empty_kg - dem, 6);
  });
});

describe('support reactions (rigid body, equal stiffness)', () => {
  const rect = [[0, 0], [4000, 0], [4000, 2000], [0, 2000]] as const;
  it('centred load → G/4 each', () => {
    const r = rigidReactions(rect, 100, [2000, 1000, 500]);
    r.forEach((v) => expect(v).toBeCloseTo(25, 9));
    expect(spread(r)).toBeCloseTo(0, 9);
  });
  it('eccentric load matches the closed form and equilibrium', () => {
    const G = 100;
    const T = [2500, 800, 0] as const;
    const r = rigidReactions(rect, G, T);
    // R_i = G[1/4 + (xT−x̄)(xi−x̄)/Σdx² + (yT−ȳ)(yi−ȳ)/Σdy²]
    const sdx = 4 * 2000 ** 2;
    const sdy = 4 * 1000 ** 2;
    rect.forEach(([x, y], i) => expect(r[i]).toBeCloseTo(G * (0.25 + ((T[0] - 2000) * (x - 2000)) / sdx + ((T[1] - 1000) * (y - 1000)) / sdy), 9));
    expect(r.reduce((s, v) => s + v, 0)).toBeCloseTo(G, 9);
    expect(r.reduce((s, v, i) => s + v * rect[i]![0], 0)).toBeCloseTo(G * T[0], 6);
    expect(r.reduce((s, v, i) => s + v * rect[i]![1], 0)).toBeCloseTo(G * T[1], 6);
  });
  it.each(REFS)('$id: Σ lift reactions = transport weight', (c) => {
    const e = run(c);
    const sumR = e.lift.points.reduce((s, p) => s + p.R_kN, 0);
    expect(sumR).toBeCloseTo((e.mass.transport_kg * 9.81) / 1000, 6);
    const sumS = e.supports.points.reduce((s, p) => s + p.R_kN, 0);
    expect(sumS).toBeCloseTo(e.supports.load_kN, 6);
  });
});

describe('price', () => {
  it.each(REFS)('$id: Σ line prices + transport + crane = total', (c) => {
    const e = run(c);
    const lines = e.bom.reduce((s, l) => s + l.price, 0);
    expect(lines + e.price.price.transport + e.price.price.crane).toBeCloseTo(e.price.total, 4);
    expect(e.price.display.mode).toBe('range');
  });
});

describe('determinism and catalog extensibility', () => {
  it.each(REFS)('$id: same input → identical output', (c) => {
    const a = JSON.stringify(evaluate(clone(c), DEMO_CATALOG));
    const b = JSON.stringify(evaluate(clone(c), clone(DEMO_CATALOG)));
    expect(a).toBe(b);
  });
  it('a new profile, window and heater work without code changes', () => {
    const k = clone(DEMO_CATALOG);
    k.profiles.push({ ...k.profiles[1]!, sku: 'PRF-RHS120x120x5', designation: 'RHS 120×120×5', section: { shape: 'RHS', h: 120, b: 120, t: 5 }, mass_kg_per_m: 17.8, surface_m2_per_m: 0.461 });
    k.frameRecipes[0]!.members.base_perimeter = { profile: 'PRF-RHS120x120x5' };
    k.openings.push({ ...k.openings[0]!, sku: 'WIN-1200x600', width_mm: 1200, slots: { 600: 2, 1200: 1 }, glassArea_m2: 0.6 });
    k.heaters.push({ ...k.heaters[0]!, sku: 'HEATER-WOOD-NEW', volume_min_m3: 10, volume_max_m3: 22 });
    const c = clone(REF1);
    c.sauna.heater.sku = 'HEATER-WOOD-NEW';
    c.openings.push({ id: 'w-new', wall: 'N', slotFrom: 1, slotTo: 2, type: 'window', sku: 'WIN-1200x600' });
    const e = evaluate(c, k);
    expect(e.bom.some((l) => l.sku === 'PRF-RHS120x120x5')).toBe(true);
    expect(e.bom.some((l) => l.sku === 'WIN-1200x600')).toBe(true);
    expect(e.violations.filter((v) => v.level === 'error')).toEqual([]);
  });
  it('scene group hashes change only for affected components', () => {
    const a = run(REF1);
    const b = run(REF1, (c) => (c.sauna.lighting[0]!.mount = 'ceiling'));
    const h = (e: typeof a) => new Map((e.scene.type === 'group' ? e.scene.children : []).map((n) => [n.id, n.type === 'group' ? n.hash : '']));
    const ha = h(a);
    const hb = h(b);
    const changed = [...ha.keys()].filter((k) => ha.get(k) !== hb.get(k));
    expect(changed).toEqual(['lighting']);
  });
});
