import ExcelJS from 'exceljs';
import { catalogToSheets, KV_SHEETS, LIST_SHEETS, type Catalog, type Cell, type Sheet } from '@sauna/core';

/** Catalog XLSX (D-050) and a human-readable diff between two catalog versions. */

export async function catalogXlsx(c: Catalog): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.created = new Date(0);
  for (const s of catalogToSheets(c)) {
    const ws = wb.addWorksheet(s.name);
    const head = ws.addRow(s.columns);
    head.font = { bold: true };
    head.eachCell((cell) => (cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFE6DA' } }));
    for (const r of s.rows) ws.addRow(r);
    ws.views = [{ state: 'frozen', ySplit: 1, xSplit: s.columns[0] === 'key' ? 1 : 1 }];
    s.columns.forEach((col, i) => (ws.getColumn(i + 1).width = Math.min(48, Math.max(10, col.length + 2))));
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

function cellValue(v: ExcelJS.CellValue): Cell {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') {
    if ('result' in v) return cellValue((v as { result: ExcelJS.CellValue }).result);
    if ('richText' in v) return (v as ExcelJS.CellRichTextValue).richText.map((t) => t.text).join('');
    if ('text' in v) return String((v as { text: unknown }).text);
  }
  return String(v);
}

export async function parseCatalogXlsx(data: Buffer): Promise<Sheet[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data as unknown as ArrayBuffer);
  const known = new Set<string>(['Meta', ...LIST_SHEETS.map((x) => x[1]), ...KV_SHEETS.map((x) => x[1])]);
  const out: Sheet[] = [];
  wb.eachSheet((ws) => {
    if (!known.has(ws.name)) return;
    const rows: Cell[][] = [];
    let columns: string[] = [];
    ws.eachRow({ includeEmpty: false }, (row, i) => {
      const vals = (row.values as ExcelJS.CellValue[]).slice(1).map(cellValue);
      if (i === 1) columns = vals.map((v) => String(v ?? ''));
      else rows.push(columns.map((_, j) => vals[j] ?? null));
    });
    out.push({ name: ws.name, columns, rows });
  });
  return out;
}

/** Key-order independent serialisation (JSONB reorders object keys). */
function stable(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  return `{${Object.keys(v as object)
    .sort()
    .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`)
    .join(',')}}`;
}

export interface CatalogDiff {
  lists: Record<string, { added: string[]; removed: string[]; changed: string[] }>;
  settings: string[];
}

export function diffCatalog(a: Catalog, b: Catalog): CatalogDiff {
  const lists: CatalogDiff['lists'] = {};
  for (const [key] of LIST_SHEETS) {
    if (key === 'electrical' || key === 'rules') {
      if (stable(a[key]) !== stable(b[key])) lists[key] = { added: [], removed: [], changed: ['*'] };
      continue;
    }
    const idOf = (x: unknown) => (x as { sku: string }).sku;
    const am = new Map((a[key] as unknown[]).map((x) => [idOf(x), stable(x)]));
    const bm = new Map((b[key] as unknown[]).map((x) => [idOf(x), stable(x)]));
    const d = {
      added: [...bm.keys()].filter((k) => !am.has(k)),
      removed: [...am.keys()].filter((k) => !bm.has(k)),
      changed: [...bm.keys()].filter((k) => am.has(k) && am.get(k) !== bm.get(k)),
    };
    if (d.added.length || d.removed.length || d.changed.length) lists[key] = d;
  }
  const settings = (['rates', 'limits', 'modules'] as const).filter((k) => stable(a[k]) !== stable(b[k]));
  return { lists, settings };
}
