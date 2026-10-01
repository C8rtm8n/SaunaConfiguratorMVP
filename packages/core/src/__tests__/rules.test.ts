import { describe, expect, it } from 'vitest';
import { DEMO_CATALOG } from '../fixtures/demoCatalog.js';
import { REF1_CUSTOM_4200_WOOD as REF1, REF2_CUSTOM_6000_TWO_ZONES as REF2, REF3_ISO20HC_GLASS_FRONT as REF3 } from '../fixtures/referenceConfigs.js';
import { applyPatch } from '../rules/patch.js';
import { evaluate } from '../evaluate.js';
import { byRule, errors, run } from './helpers.js';

const msg = (id: string, variant?: string) => {
  const r = DEMO_CATALOG.rules.find((x) => x.id === id)!;
  return (variant ? r.messages![variant]! : r.message_i18n).cs;
};
const has = (e: ReturnType<typeof run>, id: string, variant?: string) => byRule(e, id).some((v) => v.message.cs === msg(id, variant));

/** Applies the first suggested fix of a rule and re-evaluates. */
function fixed(e: ReturnType<typeof run>, id: string) {
  const v = byRule(e, id).find((x) => x.suggestedFix);
  expect(v, `${id} has a suggested fix`).toBeDefined();
  return evaluate(applyPatch(e.config, v!.suggestedFix!.patch) as typeof REF1, DEMO_CATALOG);
}

describe('reference configs are valid', () => {
  it.each([REF1, REF2, REF3])('$id has no errors', (c) => {
    const e = run(c);
    expect(errors(e)).toEqual([]);
    expect(e.submittable).toBe(true);
  });
});

describe('R01 heater volume range', () => {
  it('flags heater too small for the equivalent volume and offers a suitable one', () => {
    const e = run(REF1, (c) => (c.sauna.heater = { ...c.sauna.heater, sku: 'HEATER-EL-A' }));
    expect(has(e, 'R01')).toBe(true);
    expect(e.sauna.suitableHeaters).not.toContain('HEATER-EL-A');
    const f = fixed(e, 'R01');
    expect(byRule(f, 'R01')).toEqual([]);
    expect(f.config.sauna.heater.sku).toBe('HEATER-EL-B'); // same fuel preferred
  });
  it('equivalent volume = V + 1.2 × glass', () => {
    const e = run(REF1);
    expect(e.sauna.eqVolume_m3).toBeCloseTo(e.sauna.innerVolume_m3 + 1.2 * e.sauna.glassArea_m2, 2);
    expect(e.sauna.glassArea_m2).toBeCloseTo(1.1 + 0.45, 6);
  });
});

describe('R02 heater clearance envelope', () => {
  it('wall: side clearance violated, fix moves the heater', () => {
    const e = run(REF1, (c) => (c.sauna.heater.along_mm = 400));
    expect(has(e, 'R02', 'wall')).toBe(true);
    const f = fixed(e, 'R02');
    expect(byRule(f, 'R02')).toEqual([]);
  });
  it('bench: envelope reaches the bench', () => {
    const e = run(REF1, (c) => (c.sauna.heater = { ...c.sauna.heater, wall: 'N', along_mm: 2500 }));
    expect(has(e, 'R02', 'bench')).toBe(true);
  });
  it('glass: envelope covers a window', () => {
    const e = run(REF2, (c) => (c.sauna.heater = { ...c.sauna.heater, wall: 'S', along_mm: 1800 }));
    expect(has(e, 'R02', 'glass')).toBe(true);
  });
  it('door: envelope reaches the door passage', () => {
    const e = run(REF2, (c) => (c.sauna.heater = { ...c.sauna.heater, wall: 'P1', along_mm: 1250 }));
    expect(has(e, 'R02', 'door')).toBe(true);
  });
  it('ceiling: top clearance from catalog', () => {
    const e = run(REF1, undefined, (k) => (k.heaters.find((h) => h.sku === 'HEATER-WOOD-A')!.clearance.top_mm = 1600));
    expect(has(e, 'R02', 'ceiling')).toBe(true);
  });
});

describe('R03 cabin height', () => {
  it('error below heater minimum', () => {
    const e = run(REF1, undefined, (k) => (k.heaters.find((h) => h.sku === 'HEATER-WOOD-A')!.minCabinHeight_mm = 2400));
    expect(has(e, 'R03')).toBe(true);
  });
  it('warning top bench to ceiling outside 1100–1200', () => {
    expect(has(run(REF3), 'R03b')).toBe(true);
    expect(byRule(run(REF1), 'R03b')).toEqual([]);
  });
});

describe('R04 sauna door', () => {
  it('missing door', () => {
    const e = run(REF1, (c) => (c.openings = c.openings.filter((o) => o.type !== 'door')));
    expect(has(e, 'R04', 'missing')).toBe(true);
  });
  it('must swing out (one-click fix)', () => {
    const e = run(REF2, (c) => (c.openings.find((o) => o.id === 'door-sauna')!.door!.swing = 'in'));
    expect(has(e, 'R04', 'swing')).toBe(true);
    expect(byRule(fixed(e, 'R04'), 'R04')).toEqual([]);
  });
  it('clear width ≥ limit', () => {
    const e = run(REF1, undefined, (k) => (k.openings.find((o) => o.sku === 'DOOR-GLASS-700x1900')!.clearWidth_mm = 550));
    expect(has(e, 'R04', 'width')).toBe(true);
  });
  it('bench must not block the door', () => {
    const e = run(REF1, (c) => Object.assign(c.openings.find((o) => o.id === 'door-1')!, { slotFrom: 5, slotTo: 6 }));
    expect(has(e, 'R04', 'bench')).toBe(true);
  });
});

describe('R05 wood heater flue', () => {
  it('auto: chimney set, roof slot and flue penetration', () => {
    const e = run(REF1);
    expect(e.auto.some((a) => a.ruleId === 'R05')).toBe(true);
    expect(e.bom.some((l) => l.sku === 'CHIMNEY-SET-115' && l.transport === 'demounted')).toBe(true);
    const flue = e.penetrations.find((p) => p.kind === 'flue')!;
    expect(flue.surface).toBe('roof');
    expect(e.slots.roof!.slots.some((s) => s.occupiedBy === 'chimney')).toBe(true);
  });
  it('electric heater has no chimney', () => {
    const e = run(REF2);
    expect(e.auto.some((a) => a.ruleId === 'R05')).toBe(false);
    expect(e.penetrations.some((p) => p.kind === 'flue')).toBe(false);
  });
  it('R05b flue too close to a combustible wall', () => {
    const e = run(REF1, undefined, (k) => (k.heaters.find((h) => h.sku === 'HEATER-WOOD-A')!.flue!.offset_mm = [0, -450]));
    expect(has(e, 'R05b', 'wall')).toBe(true);
  });
});

describe('R06 ventilation', () => {
  it('supply at the heater wall low, exhaust on the opposite wall high', () => {
    const e = run(REF1);
    const s = e.penetrations.find((p) => p.kind === 'vent_supply')!;
    const x = e.penetrations.find((p) => p.kind === 'vent_exhaust')!;
    expect(s.surface).toBe('W');
    expect(x.surface).toBe('E');
    expect(s.position_mm[2]).toBeCloseTo(e.geometry.inner.min[2] + 300, 6);
    expect(x.position_mm[2]).toBeCloseTo(e.geometry.inner.max[2] - 300, 6);
    // diagonal: heater in the lower half along W (y < mid) → exhaust in the upper half along E, or vice versa
    const mid = (e.geometry.inner.min[1] + e.geometry.inner.max[1]) / 2;
    expect(Math.sign(s.position_mm[1] - mid)).not.toBe(Math.sign(x.position_mm[1] - mid));
  });
});

describe('R07 opening reinforcement', () => {
  it('custom: panorama (4 slots > 2) gets a frame, 2-slot window not', () => {
    const e = run(REF2);
    expect(e.bom.some((l) => l.componentId === 'reinf-pano-1' && l.category === 'steel')).toBe(true);
    expect(run(REF1).bom.some((l) => l.componentId.startsWith('reinf-'))).toBe(false);
  });
  it('ISO uses the stricter limit (2-slot door reinforced)', () => {
    const e = run(REF3);
    expect(e.bom.some((l) => l.componentId === 'reinf-door-1')).toBe(true);
  });
});

describe('R08 zone lengths', () => {
  it('sauna < 1 800 mm, fix moves the partition', () => {
    const e = run(REF2, (c) => {
      c.zones[0]!.to_mm = 1200;
      c.zones[1]!.from_mm = 1200;
    });
    expect(byRule(e, 'R08')).toHaveLength(1);
    const f = fixed(e, 'R08');
    expect(f.config.zones[0]!.to_mm).toBe(1800);
    expect(byRule(f, 'R08')).toEqual([]);
  });
  it('changing room < 900 mm', () => {
    const e = run(REF2, (c) => {
      c.zones[0]!.to_mm = 5400;
      c.zones[1]!.from_mm = 5400;
    });
    expect(byRule(e, 'R08').some((v) => v.params['type'] === 'changing')).toBe(true);
  });
});

describe('R09 bench supports', () => {
  it('span > max adds intermediate supports', () => {
    const e = run(REF3);
    const a = e.auto.filter((x) => x.ruleId === 'R09');
    expect(a.length).toBeGreaterThan(0);
    expect(a[0]!.params['count']).toBe(2); // 3 424 mm / 1 500 → 3 fields
  });
  it('no supports when the span fits', () => {
    const e = run(REF3, undefined, (k) => (k.benchSystems[0]!.maxSpan_mm = 5000));
    expect(e.auto.some((x) => x.ruleId === 'R09')).toBe(false);
  });
});

describe('R10 electrical', () => {
  it('electric heater: breaker and cable from the catalog table', () => {
    const e = run(REF2);
    expect(e.sauna.electrical).toEqual({ power_kw: 18, voltage: 400, breaker_A: 32, cable: 'CYKY-J 5×6' });
    expect(run(REF1).sauna.electrical).toBeUndefined();
  });
});

describe('shell validity rules', () => {
  it('S01 wrong slot count with fix', () => {
    const e = run(REF1, (c) => (c.openings[0]!.slotTo = c.openings[0]!.slotFrom));
    expect(has(e, 'S01', 'slots')).toBe(true);
    expect(byRule(fixed(e, 'S01'), 'S01')).toEqual([]);
  });
  it('S01 overlap and corner fit', () => {
    expect(has(run(REF1, (c) => c.openings.push({ id: 'w2', wall: 'S', slotFrom: 4, slotTo: 4, type: 'window', sku: 'WIN-600x600' })), 'S01', 'overlap')).toBe(true);
    expect(has(run(REF1, (c) => c.openings.push({ id: 'w2', wall: 'S', slotFrom: 0, slotTo: 0, type: 'window', sku: 'WIN-600x600' })), 'S01', 'fit')).toBe(true);
  });
  it('S02 partition off the grid', () => {
    const e = run(REF2, (c) => {
      c.zones[0]!.to_mm = 3500;
      c.zones[1]!.from_mm = 3500;
    });
    expect(has(e, 'S02', 'grid')).toBe(true);
  });
  it('S03 terrace depth not in the system', () => {
    const e = run(REF2, (c) => ((c.attachments[0] as { depth_mm: number }).depth_mm = 1500));
    expect(has(e, 'S03', 'depth')).toBe(true);
  });
  it('S10 heater on a wall that does not bound the sauna', () => {
    const e = run(REF2, (c) => (c.sauna.heater.wall = 'E'));
    expect(has(e, 'S10', 'heaterWall')).toBe(true);
  });
  it('M01 lifting reaction spread', () => {
    const e = run(REF3, undefined, (k) => (k.containers[0]!.cog_mm = [1200, 1219, 1150]));
    expect(byRule(e, 'M01')).toHaveLength(1);
    expect(e.lift.warn).toBe(true);
  });
  it('T01 oversize: ISO HC on the truck is too high', () => {
    const e = run(REF3);
    expect(byRule(e, 'T01')).toHaveLength(1);
    expect(e.transport.oversizeReasons).toEqual(['height']);
  });
});

describe('rule data integrity', () => {
  it('every rule references a registered function', () => {
    // evaluate() throws on unknown fn; run all refs with all rules active
    for (const c of [REF1, REF2, REF3]) expect(() => run(c)).not.toThrow();
  });
  it('rule ids are unique', () => {
    const ids = DEMO_CATALOG.rules.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
