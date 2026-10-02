import type { Catalog } from '@sauna/core';

/** Editable columns per catalog list (dot paths). Other fields: XLSX or the JSON editor. */
export type ColType = 'text' | 'number' | 'bool' | { options: string[] };
export interface Col {
  path: string;
  label: string;
  type: ColType;
  width?: number;
}

export interface ListSpec {
  key: keyof Catalog;
  label: string;
  cols: Col[];
}

const base = (extra: Col[]): Col[] => [
  { path: 'sku', label: 'SKU', type: 'text', width: 170 },
  { path: 'name.cs', label: 'Název (cs)', type: 'text', width: 230 },
  { path: 'name.de', label: 'Název (de)', type: 'text', width: 180 },
  ...extra,
  { path: 'active', label: 'Aktivní', type: 'bool' },
  { path: 'source.placeholder', label: 'Placeholder', type: 'bool' },
];

export const LISTS: ListSpec[] = [
  {
    key: 'profiles',
    label: 'Profily',
    cols: base([
      { path: 'designation', label: 'Označení', type: 'text', width: 130 },
      { path: 'material', label: 'Materiál (SKU)', type: 'text', width: 110 },
      { path: 'mass_kg_per_m', label: 'kg/m', type: 'number' },
      { path: 'surface_m2_per_m', label: 'm²/m', type: 'number' },
      { path: 'waste', label: 'Prořez (0–1)', type: 'number' },
    ]),
  },
  {
    key: 'steel',
    label: 'Ocel',
    cols: base([
      { path: 'grade', label: 'Jakost', type: 'text' },
      { path: 'density_kg_m3', label: 'kg/m³', type: 'number' },
      { path: 'cost_per_kg', label: 'Kč/kg', type: 'number' },
      { path: 'coating_cost_per_m2', label: 'Nátěr Kč/m²', type: 'number' },
    ]),
  },
  {
    key: 'panels',
    label: 'Obklady a plošné',
    cols: base([
      { path: 'role', label: 'Role', type: { options: ['exterior_cladding', 'roof_covering', 'interior_cladding', 'insulation', 'membrane', 'vapour_barrier', 'sheathing', 'floor', 'bench_board', 'decking'] }, width: 150 },
      { path: 'thickness_mm', label: 'Tl. mm', type: 'number' },
      { path: 'mass_kg_per_m2', label: 'kg/m²', type: 'number' },
      { path: 'cost_per_m2', label: 'Kč/m²', type: 'number' },
      { path: 'install_h_per_m2', label: 'Montáž h/m²', type: 'number' },
      { path: 'waste', label: 'Prořez', type: 'number' },
      { path: 'combustible', label: 'Hořlavé', type: 'bool' },
      { path: 'board.coverWidth_mm', label: 'Krycí šířka', type: 'number' },
      { path: 'appearance', label: 'Vzhled 3D', type: 'text' },
    ]),
  },
  {
    key: 'heaters',
    label: 'Kamna',
    cols: base([
      { path: 'fuel', label: 'Palivo', type: { options: ['wood', 'electric'] } },
      { path: 'power_kw', label: 'kW', type: 'number' },
      { path: 'volume_min_m3', label: 'Objem min', type: 'number' },
      { path: 'volume_max_m3', label: 'Objem max', type: 'number' },
      { path: 'clearance.side_mm', label: 'Odstup bok', type: 'number' },
      { path: 'clearance.front_mm', label: 'Odstup čelo', type: 'number' },
      { path: 'clearance.back_mm', label: 'Odstup záda', type: 'number' },
      { path: 'clearance.top_mm', label: 'Odstup strop', type: 'number' },
      { path: 'size.w_mm', label: 'Š', type: 'number' },
      { path: 'size.d_mm', label: 'H', type: 'number' },
      { path: 'size.h_mm', label: 'V', type: 'number' },
      { path: 'mass_kg', label: 'kg vč. kamenů', type: 'number' },
      { path: 'stones_kg', label: 'Kameny kg', type: 'number' },
      { path: 'minCabinHeight_mm', label: 'Min. výška kabiny', type: 'number' },
      { path: 'electrical.voltage', label: 'Napětí V', type: 'number' },
      { path: 'cost', label: 'Nákup Kč', type: 'number' },
    ]),
  },
  {
    key: 'openings',
    label: 'Okna, dveře, skla',
    cols: base([
      { path: 'type', label: 'Typ', type: { options: ['window', 'panorama', 'glass_front', 'door', 'vent'] } },
      { path: 'width_mm', label: 'Šířka', type: 'number' },
      { path: 'height_mm', label: 'Výška', type: 'number' },
      { path: 'sill_mm', label: 'Parapet', type: 'number' },
      { path: 'slots.600', label: 'Slotů (600)', type: 'number' },
      { path: 'slots.1200', label: 'Slotů (1200)', type: 'number' },
      { path: 'fullWall', label: 'Celá stěna', type: 'bool' },
      { path: 'clearWidth_mm', label: 'Světlá šířka', type: 'number' },
      { path: 'glassArea_m2', label: 'Sklo m²', type: 'number' },
      { path: 'mass_kg', label: 'kg', type: 'number' },
      { path: 'cost', label: 'Nákup Kč', type: 'number' },
      { path: 'install_h', label: 'Montáž h', type: 'number' },
    ]),
  },
  {
    key: 'purchased',
    label: 'Světla a příslušenství',
    cols: base([
      { path: 'category', label: 'Kategorie', type: { options: ['light', 'chimney', 'vent', 'electrical', 'accessory', 'foundation', 'fixing', 'lifting'] } },
      { path: 'mass_kg', label: 'kg', type: 'number' },
      { path: 'cost', label: 'Nákup Kč', type: 'number' },
      { path: 'install_h', label: 'Montáž h', type: 'number' },
      { path: 'demountable', label: 'Demontáž', type: 'bool' },
    ]),
  },
  {
    key: 'timber',
    label: 'Řezivo',
    cols: base([
      { path: 'species', label: 'Dřevina', type: 'text' },
      { path: 'b_mm', label: 'b mm', type: 'number' },
      { path: 'h_mm', label: 'h mm', type: 'number' },
      { path: 'density_kg_m3', label: 'kg/m³', type: 'number' },
      { path: 'cost_per_m', label: 'Kč/m', type: 'number' },
      { path: 'waste', label: 'Prořez', type: 'number' },
    ]),
  },
  {
    key: 'attachmentSystems',
    label: 'Terasy a přídavky',
    cols: base([
      { path: 'type', label: 'Typ', type: { options: ['terrace', 'roof_overhang', 'stairs', 'railing'] } },
      { path: 'basis', label: 'Jednotka', type: { options: ['m2', 'm', 'ks'] } },
      { path: 'mass_kg_per_unit', label: 'kg/j', type: 'number' },
      { path: 'cost_per_unit', label: 'Nákup Kč/j', type: 'number' },
      { path: 'install_h_per_unit', label: 'Montáž h/j', type: 'number' },
      { path: 'demountable', label: 'Demontáž', type: 'bool' },
    ]),
  },
];

export function getPath(o: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((a, k) => (a && typeof a === 'object' ? (a as Record<string, unknown>)[k] : undefined), o);
}

export function setPath(o: Record<string, unknown>, path: string, v: unknown): void {
  const parts = path.split('.');
  let cur = o;
  for (const k of parts.slice(0, -1)) {
    if (!cur[k] || typeof cur[k] !== 'object') cur[k] = {};
    cur = cur[k] as Record<string, unknown>;
  }
  const last = parts[parts.length - 1]!;
  if (v === undefined || v === '') delete cur[last];
  else cur[last] = v;
}
