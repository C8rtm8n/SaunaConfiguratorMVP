import { describe, expect, it } from 'vitest';
import { catalogToSheets, sheetsToCatalog } from '../catalog/tabular.js';
import { validateCatalog } from '../catalog/validate.js';
import { DEMO_CATALOG } from '../fixtures/demoCatalog.js';
import { clone } from './helpers.js';

describe('catalog validation', () => {
  it('demo catalog has no errors (placeholders are warnings)', () => {
    const issues = validateCatalog(DEMO_CATALOG);
    expect(issues.filter((i) => i.level === 'error')).toEqual([]);
    expect(issues.some((i) => i.level === 'warning' && i.path.startsWith('heaters'))).toBe(true);
  });
  it('finds broken references, bad ranges and duplicate SKUs', () => {
    const c = clone(DEMO_CATALOG);
    c.profiles[0]!.material = 'NOPE';
    c.heaters[0]!.volume_max_m3 = 1;
    c.panels[0]!.mass_kg_per_m2 = -3;
    c.frameRecipes[0]!.members.base_perimeter = { profile: 'PRF-X' };
    const paths = validateCatalog(c).filter((i) => i.level === 'error').map((i) => i.path);
    expect(paths).toEqual(expect.arrayContaining(['profiles[0].material', 'heaters[0].volume_min_m3', 'panels[0].mass_kg_per_m2', 'frameRecipes[0].members.base_perimeter']));
    const d = clone(DEMO_CATALOG);
    d.heaters.push(clone(d.heaters[0]!));
    expect(validateCatalog(d)[0]!.message).toContain('duplicate SKU');
  });
  it('smoke evaluation catches rules with unknown functions', () => {
    const c = clone(DEMO_CATALOG);
    c.rules = [...c.rules, { ...c.rules[0]!, id: 'X1', check: { kind: 'fn', fn: 'doesNotExist' } }];
    expect(validateCatalog(c).some((i) => i.path.startsWith('smoke.'))).toBe(true);
  });
});

describe('catalog ⇄ sheets', () => {
  it('round-trips the whole catalog', () => {
    expect(sheetsToCatalog(catalogToSheets(DEMO_CATALOG), DEMO_CATALOG)).toEqual(DEMO_CATALOG);
  });
  it('a new heater added as a row is a valid catalog item', () => {
    const sheets = catalogToSheets(DEMO_CATALOG);
    const h = sheets.find((s) => s.name === 'Kamna')!;
    const row = [...h.rows[0]!];
    row[h.columns.indexOf('sku')] = 'HEATER-NEW';
    row[h.columns.indexOf('power_kw')] = 12;
    h.rows.push(row);
    const c = sheetsToCatalog(sheets, DEMO_CATALOG);
    expect(c.heaters.find((x) => x.sku === 'HEATER-NEW')!.power_kw).toBe(12);
    expect(validateCatalog(c).filter((i) => i.level === 'error')).toEqual([]);
  });
  it('missing sheets keep the base values', () => {
    const only = catalogToSheets(DEMO_CATALOG).filter((s) => s.name === 'Sazby');
    only[0]!.rows = only[0]!.rows.map(([k, v]) => [k ?? null, k === 'labour_per_h' ? 700 : (v ?? null)]);
    const c = sheetsToCatalog(only, DEMO_CATALOG);
    expect(c.rates.labour_per_h).toBe(700);
    expect(c.heaters).toEqual(DEMO_CATALOG.heaters);
  });
});
