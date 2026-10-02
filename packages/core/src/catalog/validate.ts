import type { Catalog, CatalogKind } from '../model/catalog.js';
import { createCatalogIndex } from './index.js';
import { defaultConfig, normalizeConfig } from '../edit/ops.js';
import { evaluate } from '../evaluate.js';

/**
 * Integrity check of a catalog before it becomes a new version (D-049):
 * unique SKUs, references between items, sane numeric ranges and a smoke
 * evaluation of the default configuration for both module types.
 */
export interface CatalogIssue {
  level: 'error' | 'warning';
  path: string;
  message: string;
}

export function validateCatalog(c: Catalog): CatalogIssue[] {
  const out: CatalogIssue[] = [];
  const err = (path: string, message: string) => out.push({ level: 'error', path, message });
  const warn = (path: string, message: string) => out.push({ level: 'warning', path, message });

  let idx: ReturnType<typeof createCatalogIndex>;
  try {
    idx = createCatalogIndex(c);
  } catch (e) {
    err('catalog', (e as Error).message);
    return out;
  }
  const ref = (path: string, kind: CatalogKind, sku: string | undefined) => {
    if (sku === undefined) return;
    if (!idx.find(kind, sku)) err(path, `odkaz na neexistující ${kind} "${sku}"`);
  };
  const pos = (path: string, v: number | undefined, allowZero = false) => {
    if (v === undefined) return;
    if (!Number.isFinite(v) || v < 0 || (!allowZero && v === 0)) err(path, `hodnota musí být ${allowZero ? '≥ 0' : '> 0'} (je ${v})`);
  };
  const ratio = (path: string, v: number) => {
    if (!Number.isFinite(v) || v < 0 || v > 1) err(path, `podíl musí být 0–1 (je ${v})`);
  };

  c.steel.forEach((x, i) => {
    pos(`steel[${i}].density_kg_m3`, x.density_kg_m3);
    pos(`steel[${i}].cost_per_kg`, x.cost_per_kg, true);
  });
  c.profiles.forEach((x, i) => {
    ref(`profiles[${i}].material`, 'steel', x.material);
    pos(`profiles[${i}].mass_kg_per_m`, x.mass_kg_per_m);
    pos(`profiles[${i}].surface_m2_per_m`, x.surface_m2_per_m);
    ratio(`profiles[${i}].waste`, x.waste);
  });
  c.timber.forEach((x, i) => {
    pos(`timber[${i}].b_mm`, x.b_mm);
    pos(`timber[${i}].h_mm`, x.h_mm);
    pos(`timber[${i}].density_kg_m3`, x.density_kg_m3);
    pos(`timber[${i}].cost_per_m`, x.cost_per_m, true);
  });
  c.panels.forEach((x, i) => {
    pos(`panels[${i}].thickness_mm`, x.thickness_mm);
    pos(`panels[${i}].mass_kg_per_m2`, x.mass_kg_per_m2);
    pos(`panels[${i}].cost_per_m2`, x.cost_per_m2, true);
    ratio(`panels[${i}].waste`, x.waste);
    if (x.board && x.board.coverWidth_mm <= 0) err(`panels[${i}].board.coverWidth_mm`, 'krycí šířka musí být > 0');
  });
  c.layups.forEach((l, i) =>
    l.layers.forEach((layer, j) => {
      const p = `layups[${i}].layers[${j}]`;
      pos(`${p}.thickness_mm`, layer.thickness_mm);
      if (layer.kind === 'panel' && !layer.sku.startsWith('$')) ref(`${p}.sku`, 'panel', layer.sku);
      if (layer.kind === 'members') {
        ref(`${p}.sku`, 'timber', layer.sku);
        pos(`${p}.spacing_mm`, layer.spacing_mm);
      }
      if ((layer.kind === 'members' || layer.kind === 'structure') && layer.fill) ref(`${p}.fill`, 'panel', layer.fill);
    }),
  );
  c.frameRecipes.forEach((f, i) => {
    for (const [role, m] of Object.entries(f.members)) ref(`frameRecipes[${i}].members.${role}`, 'steel_profile', m?.profile);
    ref(`frameRecipes[${i}].liftingLug`, 'purchased', f.liftingLug);
    for (const [s, sku] of Object.entries(f.layups)) ref(`frameRecipes[${i}].layups.${s}`, 'layup', sku);
  });
  c.foundations.forEach((f, i) => {
    ref(`foundations[${i}].pointSku`, 'purchased', f.pointSku);
    ref(`foundations[${i}].beamProfile`, 'steel_profile', f.beamProfile);
    pos(`foundations[${i}].maxSpacing_mm`, f.maxSpacing_mm);
  });
  c.openings.forEach((o, i) => {
    pos(`openings[${i}].width_mm`, o.width_mm);
    pos(`openings[${i}].height_mm`, o.height_mm);
    pos(`openings[${i}].mass_kg`, o.mass_kg, true);
    if (!o.fullWall && Object.keys(o.slots).length === 0) err(`openings[${i}].slots`, 'otvor musí zabírat aspoň jeden slot v některém rastru');
    if (o.type === 'door' && o.clearWidth_mm === undefined) warn(`openings[${i}].clearWidth_mm`, 'dveře bez světlé šířky (R04 použije šířku produktu)');
  });
  c.heaters.forEach((h, i) => {
    pos(`heaters[${i}].power_kw`, h.power_kw);
    if (!(h.volume_min_m3 > 0 && h.volume_max_m3 > h.volume_min_m3)) err(`heaters[${i}].volume_min_m3`, `rozsah objemu ${h.volume_min_m3}–${h.volume_max_m3} m³ není platný`);
    for (const [k, v] of Object.entries(h.clearance)) pos(`heaters[${i}].clearance.${k}`, v, true);
    for (const [k, v] of Object.entries(h.size)) pos(`heaters[${i}].size.${k}`, v);
    pos(`heaters[${i}].mass_kg`, h.mass_kg);
    if (h.stones_kg > h.mass_kg) err(`heaters[${i}].stones_kg`, 'kameny nemohou vážit víc než kamna včetně kamenů');
    if (h.fuel === 'wood' && !h.flue) err(`heaters[${i}].flue`, 'kamna na dřevo musí mít kouřovod');
    if (h.flue) ref(`heaters[${i}].flue.chimneySku`, 'purchased', h.flue.chimneySku);
    if (h.fuel === 'electric' && !h.electrical) err(`heaters[${i}].electrical`, 'elektrická kamna musí mít napětí');
    if (h.fuel === 'electric' && h.electrical && !c.electrical.some((r) => r.voltage === h.electrical!.voltage && r.maxPower_kw >= h.power_kw)) {
      warn(`heaters[${i}].power_kw`, `tabulka jističů nepokrývá ${h.power_kw} kW / ${h.electrical.voltage} V`);
    }
    if (h.source?.placeholder) warn(`heaters[${i}].source`, 'zástupné hodnoty – ověřit v manuálu výrobce');
  });
  c.benchSystems.forEach((b, i) => {
    ref(`benchSystems[${i}].board`, 'panel', b.board);
    ref(`benchSystems[${i}].support`, 'timber', b.support);
    if (b.levels.length < 2) err(`benchSystems[${i}].levels`, 'lavice potřebuje aspoň 2 úrovně');
    pos(`benchSystems[${i}].maxSpan_mm`, b.maxSpan_mm);
  });
  c.purchased.forEach((p, i) => pos(`purchased[${i}].mass_kg`, p.mass_kg, true));
  c.attachmentSystems.forEach((a, i) => pos(`attachmentSystems[${i}].mass_kg_per_unit`, a.mass_kg_per_unit, true));
  ref('limits.ventilation.grilleSku', 'purchased', c.limits.ventilation.grilleSku);
  ref('modules.iso_20hc.container', 'container', c.modules.iso_20hc.container);
  const mo = c.modules.custom_frame;
  if (!(mo.length_mm.min > 0 && mo.length_mm.max >= mo.length_mm.min && mo.length_mm.step > 0)) err('modules.custom_frame.length_mm', 'neplatný rozsah délek');
  if (!mo.widths_mm.length) err('modules.custom_frame.widths_mm', 'chybí šířky');
  for (const [k, v] of Object.entries(c.rates.margin)) if (!Number.isFinite(v) || v < -0.5 || v > 5) err(`rates.margin.${k}`, `marže ${v} mimo rozumný rozsah`);
  ratio('rates.priceRange', c.rates.priceRange);
  pos('rates.labour_per_h', c.rates.labour_per_h, true);

  // Smoke evaluation (also catches rules referencing unknown functions).
  if (!out.some((x) => x.level === 'error')) {
    for (const type of ['custom_frame', 'iso_20hc'] as const) {
      try {
        const base = defaultConfig(c);
        evaluate(normalizeConfig({ ...base, module: { ...base.module, type } }, c), c);
      } catch (e) {
        err(`smoke.${type}`, `výpočet výchozí konfigurace selhal: ${(e as Error).message}`);
      }
    }
  }
  return out;
}
