import type { AssemblyId, BomCategory, BomLine, BomRow } from '../model/bom.js';

const CAT_ORDER: BomCategory[] = ['steel', 'timber', 'purchased'];
const CAT_PREFIX: Record<BomCategory, string> = { steel: 'S', timber: 'D', purchased: 'N' };
const ASM_ORDER: AssemblyId[] = ['frame', 'shell', 'insulation', 'interior', 'glazing', 'heater', 'chimney', 'electrical', 'terrace', 'attachments', 'foundation'];

const key = (l: BomLine) => `${l.category}|${l.assembly}|${l.sku}|${l.len_mm ?? ''}|${l.transport}|${l.description}`;

/**
 * Aggregates raw lines into export rows (same category, assembly, SKU, cut length)
 * and assigns positions deterministically, e.g. S01, D07, N03. Writes `pos` back to raw lines.
 */
export function aggregateBom(lines: BomLine[]): BomRow[] {
  const groups = new Map<string, BomLine[]>();
  for (const l of lines) {
    const k = key(l);
    const g = groups.get(k);
    if (g) g.push(l);
    else groups.set(k, [l]);
  }
  const rows: BomRow[] = [];
  for (const g of groups.values()) {
    const f = g[0]!;
    const sum = (sel: (l: BomLine) => number) => g.reduce((s, l) => s + sel(l), 0);
    const { componentId: _c, cog_mm: _g, ...rest } = f;
    const row: BomRow = {
      ...rest,
      qty: sum((l) => l.qty),
      mass_kg: sum((l) => l.mass_kg),
      cost: sum((l) => l.cost),
      materialCost: sum((l) => l.materialCost),
      labourCost: sum((l) => l.labourCost),
      price: sum((l) => l.price),
      labour_h: sum((l) => l.labour_h),
      componentIds: [...new Set(g.map((l) => l.componentId))].sort(),
    };
    if (f.surface_m2 !== undefined) row.surface_m2 = sum((l) => l.surface_m2 ?? 0);
    rows.push(row);
  }
  rows.sort(
    (a, b) =>
      CAT_ORDER.indexOf(a.category) - CAT_ORDER.indexOf(b.category) ||
      ASM_ORDER.indexOf(a.assembly) - ASM_ORDER.indexOf(b.assembly) ||
      a.sku.localeCompare(b.sku) ||
      (b.len_mm ?? 0) - (a.len_mm ?? 0) ||
      a.transport.localeCompare(b.transport) ||
      a.description.localeCompare(b.description),
  );
  const counters: Record<string, number> = {};
  const posByKey = new Map<string, string>();
  for (const r of rows) {
    const n = (counters[r.category] = (counters[r.category] ?? 0) + 1);
    r.pos = `${CAT_PREFIX[r.category]}${String(n).padStart(2, '0')}`;
    posByKey.set(`${r.category}|${r.assembly}|${r.sku}|${r.len_mm ?? ''}|${r.transport}|${r.description}`, r.pos);
  }
  for (const l of lines) l.pos = posByKey.get(key(l)) ?? '';
  return rows;
}
