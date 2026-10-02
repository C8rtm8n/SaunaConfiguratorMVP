import { describe, expect, it } from 'vitest';
import { evaluate } from '../evaluate.js';
import { toPublicCatalog } from '../catalog/public.js';
import { addOpening, defaultConfig, normalizeConfig, removeOpening, setLayout, setOverhang, setTerrace } from '../edit/ops.js';
import { DEMO_CATALOG } from '../fixtures/demoCatalog.js';
import { REFERENCE_CONFIGS } from '../fixtures/referenceConfigs.js';
import { clone } from './helpers.js';

const errors = (c: Parameters<typeof evaluate>[0]) => evaluate(c, DEMO_CATALOG).violations.filter((v) => v.level === 'error');

describe('public (sell-price) catalog', () => {
  it.each(Object.values(REFERENCE_CONFIGS))('$id: same price, BOM and mass as the tenant catalog', (c) => {
    const a = evaluate(c, DEMO_CATALOG);
    const b = evaluate(c, toPublicCatalog(DEMO_CATALOG));
    expect(b.price.total).toBeCloseTo(a.price.total, 6);
    expect(b.price.display).toEqual(a.price.display);
    expect(b.mass.empty_kg).toBe(a.mass.empty_kg);
    expect(b.bomRows.map((r) => [r.pos, r.sku, r.qty])).toEqual(a.bomRows.map((r) => [r.pos, r.sku, r.qty]));
    b.bomRows.forEach((r, i) => expect(r.price).toBeCloseTo(a.bomRows[i]!.price, 6));
  });
  it('contains no purchase prices or margins', () => {
    const p = toPublicCatalog(DEMO_CATALOG);
    expect(Object.values(p.rates.margin).every((m) => m === 0)).toBe(true);
    expect(p.heaters[0]!.cost).toBeCloseTo(DEMO_CATALOG.heaters[0]!.cost * (1 + DEMO_CATALOG.rates.margin.purchased), 9);
    expect(p.pricing).toBe('sell');
  });
});

describe('editing operations', () => {
  it('default config is valid', () => {
    const c = defaultConfig(DEMO_CATALOG);
    expect(errors(c)).toEqual([]);
    expect(c.openings.some((o) => o.type === 'door')).toBe(true);
  });

  it('changing the length keeps zones and openings consistent', () => {
    const base = setLayout(defaultConfig(DEMO_CATALOG), DEMO_CATALOG, 2, true, 2400);
    for (const L of [3600, 4800, 6000, 9999, 100]) {
      const c = normalizeConfig({ ...base, module: { ...base.module, L_mm: L } }, DEMO_CATALOG);
      expect(c.module.L_mm % 600).toBe(0);
      expect(c.module.L_mm).toBeGreaterThanOrEqual(3600);
      expect(c.module.L_mm).toBeLessThanOrEqual(6000);
      expect(c.zones.at(-1)!.to_mm).toBe(c.module.L_mm);
      const e = evaluate(c, DEMO_CATALOG);
      expect(e.violations.filter((v) => v.ruleId.startsWith('S0'))).toEqual([]); // structural rules never fire
    }
  });

  it('switching to ISO uses the container dimensions and drops products not allowed for ISO', () => {
    let c = defaultConfig(DEMO_CATALOG);
    c = addOpening(c, DEMO_CATALOG, 'E', 0, 'GLASS-FRONT-CUSTOM').config!;
    c = normalizeConfig({ ...c, module: { ...c.module, type: 'iso_20hc' } }, DEMO_CATALOG);
    expect([c.module.L_mm, c.module.W_mm, c.module.H_mm]).toEqual([6058, 2438, 2896]);
    expect(c.openings.some((o) => o.sku === 'GLASS-FRONT-CUSTOM')).toBe(false);
  });

  it('removing the second zone drops partition openings and moves the heater', () => {
    let c = setLayout(defaultConfig(DEMO_CATALOG), DEMO_CATALOG, 2, true, 2400);
    c = addOpening(c, DEMO_CATALOG, 'P1', 0, 'DOOR-GLASS-700x1900').config!;
    c.sauna.heater.wall = 'P1';
    c = setLayout(c, DEMO_CATALOG, 1);
    expect(c.openings.some((o) => o.wall === 'P1')).toBe(false);
    expect(c.sauna.heater.wall).not.toBe('P1');
  });

  it('addOpening covers the clicked slot, shifts at the wall end, refuses occupied slots', () => {
    const c = defaultConfig(DEMO_CATALOG); // door on S slots 3–4
    const r = addOpening(c, DEMO_CATALOG, 'S', 6, 'WIN-900x600');
    expect(r.config!.openings.find((o) => o.id === r.openingId)).toMatchObject({ slotFrom: 5, slotTo: 6 });
    expect(addOpening(c, DEMO_CATALOG, 'S', 4, 'WIN-600x600').error).toBe('occupied');
    expect(addOpening(c, DEMO_CATALOG, 'P1', 0, 'WIN-600x600').error).toBe('no_wall');
    expect(removeOpening(r.config!, r.openingId!).openings).toHaveLength(c.openings.length);
  });

  it('terrace presets and overhang', () => {
    let c = setTerrace(defaultConfig(DEMO_CATALOG), DEMO_CATALOG, 'front', { railing: true, stairs: true });
    expect(c.attachments.map((a) => a.type).sort()).toEqual(['railing', 'stairs', 'terrace']);
    c = setOverhang(c, DEMO_CATALOG, 'E');
    expect(errors(c).filter((v) => v.ruleId === 'S03')).toEqual([]);
    c = setTerrace(c, DEMO_CATALOG, 'none');
    expect(c.attachments.map((a) => a.type)).toEqual(['roof_overhang']);
  });

  it('normalize is idempotent', () => {
    for (const c of [...Object.values(REFERENCE_CONFIGS), defaultConfig(DEMO_CATALOG)]) {
      const once = normalizeConfig(clone(c), DEMO_CATALOG);
      expect(normalizeConfig(once, DEMO_CATALOG)).toEqual(once);
    }
  });
});
