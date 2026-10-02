import ExcelJS from 'exceljs';
import type { BomRow, Evaluation } from '@sauna/core';

/** BOM exports (D-044): CSV (one table, ';' + UTF-8 BOM for Excel cs) and XLSX with 4 sheets. */

const r = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const kgPerM = (x: BomRow) => (x.len_mm && x.qty ? x.mass_kg / ((x.len_mm / 1000) * x.qty) : null);

export function bomCsv(ev: Evaluation): Buffer {
  const head = ['pozice', 'kategorie', 'sestava', 'sku', 'popis', 'material', 'profil', 'delka_mm', 'mnozstvi', 'mj', 'kg_m', 'kg_celkem', 'povrch_m2', 'prorez_pct', 'preprava'];
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : typeof v === 'number' ? String(v).replace('.', ',') : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [head.join(';')];
  for (const x of ev.bomRows) {
    lines.push(
      [x.pos, x.category, x.assembly, x.sku, x.description, x.material, x.profile ?? '', x.len_mm ? r(x.len_mm, 1) : '', r(x.qty, 3), x.unit, kgPerM(x) !== null ? r(kgPerM(x)!, 3) : '', r(x.mass_kg, 3), x.surface_m2 !== undefined ? r(x.surface_m2, 3) : '', r(x.waste_pct * 100, 1), x.transport]
        .map(esc)
        .join(';'),
    );
  }
  return Buffer.concat([Buffer.from('﻿'), Buffer.from(lines.join('\r\n') + '\r\n', 'utf8')]);
}

export async function bomXlsx(ev: Evaluation, meta: { tenant: string; configId: string; revision: number }): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = meta.tenant;
  wb.created = new Date(0); // deterministic file content for the same input
  const title = `${meta.tenant} · konfigurace ${meta.configId} / rev. ${meta.revision} · katalog ${ev.catalogVersion}`;
  const sheet = (name: string, cols: Array<{ header: string; key: string; width: number; fmt?: string }>, rows: Array<Record<string, unknown>>, totals?: Record<string, unknown>) => {
    const ws = wb.addWorksheet(name);
    ws.addRow([title]).font = { italic: true, color: { argb: 'FF666666' } };
    const hr = ws.addRow(cols.map((c) => c.header));
    hr.font = { bold: true };
    hr.eachCell((c) => (c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFE6DA' } }));
    cols.forEach((c, i) => {
      ws.getColumn(i + 1).width = c.width;
      if (c.fmt) ws.getColumn(i + 1).numFmt = c.fmt;
    });
    for (const row of rows) ws.addRow(cols.map((c) => row[c.key] ?? null));
    if (totals) ws.addRow(cols.map((c) => totals[c.key] ?? null)).font = { bold: true };
    ws.views = [{ state: 'frozen', ySplit: 2 }];
  };
  const steel = ev.bomRows.filter((x) => x.category === 'steel');
  sheet(
    'Ocel',
    [
      { header: 'Pozice', key: 'pos', width: 8 },
      { header: 'Sestava', key: 'assembly', width: 12 },
      { header: 'Profil / popis', key: 'profile', width: 30 },
      { header: 'Materiál', key: 'material', width: 12 },
      { header: 'Délka [mm]', key: 'len', width: 12, fmt: '0.0' },
      { header: 'ks', key: 'qty', width: 6 },
      { header: 'kg/m', key: 'kgm', width: 8, fmt: '0.00' },
      { header: 'kg celkem', key: 'mass', width: 11, fmt: '0.00' },
      { header: 'Povrch. úprava [m²]', key: 'surface', width: 18, fmt: '0.00' },
      { header: 'Prořez [%]', key: 'waste', width: 10, fmt: '0.0' },
    ],
    steel.map((x) => ({ pos: x.pos, assembly: x.assembly, profile: x.profile ?? x.description, material: x.material, len: x.len_mm ?? null, qty: x.qty, kgm: kgPerM(x), mass: r(x.mass_kg, 3), surface: x.surface_m2 ?? null, waste: x.waste_pct * 100 })),
    { pos: 'Σ', mass: r(steel.reduce((s, x) => s + x.mass_kg, 0), 2), surface: r(steel.reduce((s, x) => s + (x.surface_m2 ?? 0), 0), 2) },
  );
  const timber = ev.bomRows.filter((x) => x.category === 'timber');
  sheet(
    'Dřevo a plášť',
    [
      { header: 'Pozice', key: 'pos', width: 8 },
      { header: 'Sestava', key: 'assembly', width: 12 },
      { header: 'SKU', key: 'sku', width: 22 },
      { header: 'Popis', key: 'desc', width: 36 },
      { header: 'm²', key: 'm2', width: 9, fmt: '0.00' },
      { header: 'bm', key: 'm', width: 9, fmt: '0.00' },
      { header: 'ks', key: 'ks', width: 6 },
      { header: 'Prořez [%]', key: 'waste', width: 10, fmt: '0.0' },
      { header: 'Množství vč. prořezu', key: 'gross', width: 18, fmt: '0.00' },
      { header: 'kg', key: 'mass', width: 9, fmt: '0.0' },
    ],
    timber.map((x) => ({ pos: x.pos, assembly: x.assembly, sku: x.sku, desc: x.description, m2: x.unit === 'm2' ? x.qty : null, m: x.unit === 'm' ? x.qty : null, ks: x.unit === 'ks' ? x.qty : null, waste: x.waste_pct * 100, gross: x.qty * (1 + x.waste_pct), mass: x.mass_kg })),
    { pos: 'Σ', mass: r(timber.reduce((s, x) => s + x.mass_kg, 0), 1) },
  );
  const bought = ev.bomRows.filter((x) => x.category === 'purchased');
  sheet(
    'Nakupované díly',
    [
      { header: 'Pozice', key: 'pos', width: 8 },
      { header: 'Sestava', key: 'assembly', width: 12 },
      { header: 'SKU', key: 'sku', width: 22 },
      { header: 'Popis', key: 'desc', width: 48 },
      { header: 'Množství', key: 'qty', width: 10, fmt: '0.00' },
      { header: 'MJ', key: 'unit', width: 6 },
      { header: 'kg', key: 'mass', width: 9, fmt: '0.0' },
      { header: 'Demontováno pro přepravu', key: 'dem', width: 22 },
    ],
    bought.map((x) => ({ pos: x.pos, assembly: x.assembly, sku: x.sku, desc: x.description, qty: x.qty, unit: x.unit, mass: x.mass_kg, dem: x.transport === 'demounted' ? 'ano' : '' })),
  );
  const m = ev.mass;
  sheet(
    'Souhrn hmotností',
    [
      { header: 'Sestava', key: 'a', width: 30 },
      { header: 'kg', key: 'kg', width: 10, fmt: '0.0' },
      { header: 'Těžiště x [mm]', key: 'x', width: 14, fmt: '0' },
      { header: 'Těžiště y [mm]', key: 'y', width: 14, fmt: '0' },
      { header: 'Těžiště z [mm]', key: 'z', width: 14, fmt: '0' },
    ],
    [
      ...Object.entries(m.byAssembly).map(([a, v]) => ({ a, kg: v!.mass_kg, x: v!.cog_mm[0], y: v!.cog_mm[1], z: v!.cog_mm[2] })),
      { a: 'Prázdná (osazená, bez základů)', kg: m.empty_kg, x: m.empty_cog_mm[0], y: m.empty_cog_mm[1], z: m.empty_cog_mm[2] },
      { a: 'Přepravní (bez demontovaných dílů)', kg: m.transport_kg, x: m.transport_cog_mm[0], y: m.transport_cog_mm[1], z: m.transport_cog_mm[2] },
      { a: 'Základy (samostatně)', kg: m.foundation_kg },
    ],
  );
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Full JSON export (admin): configuration + all computed outputs, versioned schema. */
export function configJson(ev: Evaluation, meta: { tenant: string; configId: string; revision: number }): Buffer {
  const { scene: _scene, bom: _bom, ...outputs } = ev;
  return Buffer.from(
    JSON.stringify({ schemaVersion: 1, evaluationSchemaVersion: ev.schemaVersion, tenant: meta.tenant, configId: meta.configId, revision: meta.revision, catalogVersion: ev.catalogVersion, config: ev.config, outputs }, null, 2),
  );
}
