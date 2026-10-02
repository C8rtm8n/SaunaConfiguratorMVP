import type { Catalog } from '../model/catalog.js';

/**
 * Catalog ⇄ tables (D-050). Each item list is one sheet; nested objects become
 * dot-path columns ("clearance.side_mm", "name.de", "slots.600"), arrays a JSON cell.
 * Rates, limits, modules and meta are key/value sheets. The API maps sheets to XLSX.
 */
export type Cell = string | number | boolean | null;
export interface Sheet {
  name: string;
  columns: string[];
  rows: Cell[][];
}

export const LIST_SHEETS = [
  ['steel', 'Ocel'],
  ['profiles', 'Profily'],
  ['timber', 'Řezivo'],
  ['panels', 'Plošné materiály'],
  ['openings', 'Okna a dveře'],
  ['heaters', 'Kamna'],
  ['benchSystems', 'Lavice'],
  ['purchased', 'Nakupované díly'],
  ['attachmentSystems', 'Přídavky'],
  ['foundations', 'Osazení'],
  ['containers', 'Kontejnery'],
  ['layups', 'Skladby'],
  ['frameRecipes', 'Rámy'],
  ['electrical', 'Elektro tabulka'],
  ['rules', 'Pravidla'],
] as const satisfies ReadonlyArray<readonly [keyof Catalog, string]>;

export const KV_SHEETS = [
  ['rates', 'Sazby'],
  ['limits', 'Limity'],
  ['modules', 'Moduly'],
] as const satisfies ReadonlyArray<readonly [keyof Catalog, string]>;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function flatten(o: Record<string, unknown>, prefix = '', out: Record<string, Cell> = {}): Record<string, Cell> {
  for (const [k, v] of Object.entries(o)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v === undefined) continue;
    if (v === null) out[p] = 'null';
    else if (isObj(v) && Object.keys(v).length === 0) out[p] = '{}';
    else if (isObj(v)) flatten(v, p, out);
    else if (Array.isArray(v)) out[p] = JSON.stringify(v);
    else out[p] = v as Cell;
  }
  return out;
}

function setPath(o: Record<string, unknown>, path: string, v: unknown): void {
  const parts = path.split('.');
  let cur = o;
  for (const k of parts.slice(0, -1)) {
    if (!isObj(cur[k])) cur[k] = {};
    cur = cur[k] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]!] = v;
}

function parseCell(v: Cell): unknown {
  if (typeof v === 'string') {
    const s = v.trim();
    if (s === 'null') return null;
    if ((s.startsWith('[') && s.endsWith(']')) || (s.startsWith('{') && s.endsWith('}'))) {
      try {
        return JSON.parse(s);
      } catch {
        return v;
      }
    }
  }
  return v;
}

export function catalogToSheets(c: Catalog): Sheet[] {
  const sheets: Sheet[] = [{ name: 'Meta', columns: ['key', 'value'], rows: [['tenantId', c.tenantId], ['version', c.version], ['pricing', c.pricing]] }];
  for (const [key, name] of LIST_SHEETS) {
    const items = (c[key] as unknown as Array<Record<string, unknown>>).map((x) => flatten(x));
    const columns: string[] = [];
    for (const it of items) for (const k of Object.keys(it)) if (!columns.includes(k)) columns.push(k);
    sheets.push({ name, columns, rows: items.map((it) => columns.map((col) => it[col] ?? null)) });
  }
  for (const [key, name] of KV_SHEETS) {
    sheets.push({ name, columns: ['key', 'value'], rows: Object.entries(flatten(c[key] as unknown as Record<string, unknown>)) });
  }
  return sheets;
}

/** Inverse of catalogToSheets; sheets that are missing keep the values of `base`. */
export function sheetsToCatalog(sheets: Sheet[], base: Catalog): Catalog {
  const byName = new Map(sheets.map((s) => [s.name, s]));
  const out = JSON.parse(JSON.stringify(base)) as Record<string, unknown>;
  const meta = byName.get('Meta');
  if (meta) for (const [k, v] of meta.rows) if (typeof k === 'string' && v !== null && k in out) out[k] = v;
  for (const [key, name] of LIST_SHEETS) {
    const s = byName.get(name);
    if (!s) continue;
    out[key] = s.rows
      .filter((r) => r.some((v) => v !== null && v !== ''))
      .map((r) => {
        const item: Record<string, unknown> = {};
        s.columns.forEach((col, i) => {
          const v = r[i];
          if (v === null || v === undefined || v === '') return;
          setPath(item, col, parseCell(v));
        });
        return item;
      });
  }
  for (const [key, name] of KV_SHEETS) {
    const s = byName.get(name);
    if (!s) continue;
    const obj: Record<string, unknown> = {};
    for (const [k, v] of s.rows) if (typeof k === 'string' && v !== null && v !== undefined && v !== '') setPath(obj, k, parseCell(v));
    out[key] = obj;
  }
  return out as unknown as Catalog;
}
