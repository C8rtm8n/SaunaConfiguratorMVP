import type { BomRow } from '../model/bom.js';
import type { I18nTemplate } from '../model/i18n.js';
import type { FactValue } from '../model/rules.js';
import type { Evaluation } from '../model/results.js';
import type { Vec3 } from '../model/units.js';

/** Fills `{name}` placeholders (cs). Presentation helper. */
export function fillTemplate(t: I18nTemplate, params: Record<string, FactValue>, locale: 'cs' | 'de' | 'en' = 'cs'): string {
  const s = t[locale] ?? t.en ?? t.cs;
  return s.replace(/\{([^}]+)\}/g, (_, k: string) => {
    const v = params[k];
    return v === undefined || v === null ? '–' : typeof v === 'number' ? fmt(v, 2) : String(v);
  });
}

const fmt = (v: number, d = 1) => (Object.is(Math.round(v * 10 ** d) / 10 ** d, -0) ? 0 : Math.round(v * 10 ** d) / 10 ** d).toLocaleString('cs-CZ', { maximumFractionDigits: d, minimumFractionDigits: 0 }).replace(/ /g, ' ');
const v3 = (v: Vec3) => `[${fmt(v[0], 0)}; ${fmt(v[1], 0)}; ${fmt(v[2], 0)}]`;

function table(head: string[], rows: string[][]): string {
  return [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
}

/** Technical markdown report of one evaluation (for manual verification of reference configs). */
export function evaluationReport(e: Evaluation, title: string): string {
  const c = e.config;
  const g = e.geometry;
  const box = (b: { min: Vec3; max: Vec3 }) => `${v3(b.min)} → ${v3(b.max)} (${fmt(b.max[0] - b.min[0], 0)} × ${fmt(b.max[1] - b.min[1], 0)} × ${fmt(b.max[2] - b.min[2], 0)})`;
  const out: string[] = [];
  out.push(`# ${title}`, '', `Konfigurace \`${c.id}\`, katalog \`${e.catalogVersion}\`. Generováno z \`@sauna/core\` (\`pnpm --filter @sauna/core report\`). Jednotky: mm, kg, kN, Kč bez DPH. Souřadnice: počátek levý přední dolní roh, X = délka, Y = šířka, Z = výška.`, '');

  out.push('## Geometrie', '');
  out.push(table(['', 'min → max (rozměry)'], [
    ['Obálka (plášť)', box(g.envelope)],
    ['Nosná konstrukce', box(g.structure)],
    ['Vnitřní světlý prostor', box(g.inner)],
    ...g.rooms.map((r) => [`Místnost ${r.zoneId} (${r.zoneType})`, box(r.box)]),
  ]));
  out.push('', table(['Skladba', 'vně', 'konstrukce', 'uvnitř', 'celkem'], Object.entries(g.layups).map(([k, l]) => [`${k} (${l.sku})`, fmt(l.ext_mm), fmt(l.structure_mm), fmt(l.int_mm), fmt(l.total_mm)])));
  out.push('', `Příčky: ${g.partitions.map((p) => `${p.id} osa x = ${fmt(p.x_mm, 0)}, tl. ${fmt(p.thickness_mm, 0)}`).join('; ') || '–'}`, '');

  const steel = e.bomRows.filter((r) => r.category === 'steel');
  out.push('## Ocel', '');
  const kgm = (r: BomRow) => (r.len_mm && r.qty ? r.mass_kg / ((r.len_mm / 1000) * r.qty) : 0);
  out.push(table(['Poz.', 'Sestava', 'Profil / popis', 'Délka', 'ks', 'kg/m', 'kg celkem', 'Povrch m²'], steel.map((r) => [r.pos, r.assembly, r.profile ?? r.description, r.len_mm ? fmt(r.len_mm, 1) : '', fmt(r.qty, 0), r.len_mm ? fmt(kgm(r), 2) : '', fmt(r.mass_kg, 2), r.surface_m2 ? fmt(r.surface_m2, 2) : ''])));
  out.push('', `Σ ocel: ${fmt(steel.reduce((s, r) => s + r.mass_kg, 0), 2)} kg`, '');

  for (const [cat, name] of [['timber', 'Dřevo a plášť'], ['purchased', 'Nakupované díly']] as const) {
    const rows = e.bomRows.filter((r) => r.category === cat);
    out.push(`## ${name}`, '');
    out.push(table(['Poz.', 'Sestava', 'SKU', 'Popis', 'Množství', 'MJ', 'Prořez', 'kg', 'Přeprava'], rows.map((r) => [r.pos, r.assembly, r.sku, r.description, fmt(r.qty, 2), r.unit, `${fmt(r.waste_pct * 100, 0)} %`, fmt(r.mass_kg, 2), r.transport === 'demounted' ? 'demont.' : ''])));
    out.push('');
  }

  out.push('## Hmotnost a těžiště', '');
  out.push(table(['Sestava', 'kg', 'Těžiště [x; y; z]'], Object.entries(e.mass.byAssembly).map(([a, m]) => [a, fmt(m!.mass_kg, 1), v3(m!.cog_mm)])));
  out.push('', table(['Stav', 'kg', 'Těžiště [x; y; z]'], [
    ['Prázdná (osazená, bez základů)', fmt(e.mass.empty_kg, 1), v3(e.mass.empty_cog_mm)],
    ['Přepravní (bez demontovaných dílů)', fmt(e.mass.transport_kg, 1), v3(e.mass.transport_cog_mm)],
    ['Základy (samostatně)', fmt(e.mass.foundation_kg, 1), ''],
  ]), '');

  out.push('## Reakce v závěsných bodech', '', `Tuhé těleso na 4 stejně tuhých podporách (D-010). G = ${fmt(e.lift.load_kN, 2)} kN, rozptyl (Rmax − Rmin)/Rmean = ${fmt(e.lift.spread * 100, 1)} %${e.lift.warn ? ' **⚠ > limit**' : ''}.`, '');
  out.push(table(['Bod', 'Poloha [x; y; z]', 'R [kN]'], e.lift.points.map((p) => [p.id, v3(p.position_mm), fmt(p.R_kN, 3)])), '');
  out.push(`## Podpěry (${e.supports.foundation})`, '', `Vlastní tíha modulu bez přídavků na vlastních podporách: ${fmt(e.supports.load_kN, 2)} kN, těžiště ${v3(e.supports.cog_mm)}. Bez užitného zatížení a sněhu.`, '');
  out.push(table(['Bod', 'Poloha [x; y]', 'R [kN]'], e.supports.points.map((p) => [p.id, `[${fmt(p.position_mm[0], 0)}; ${fmt(p.position_mm[1], 0)}]`, fmt(p.R_kN, 3)])), '');

  const t = e.transport;
  out.push('## Doprava', '', table(['', ''], [
    ['Rozměry (D × Š × V)', `${fmt(t.length_mm, 0)} × ${fmt(t.width_mm, 0)} × ${fmt(t.height_mm, 0)}`],
    ['Vozidlo', `${t.vehicleId} (ložná výška ${fmt(t.deckHeight_mm, 0)})${t.needsMobileCrane ? ' + autojeřáb' : ''}`],
    ['Výška na vozidle', fmt(t.heightOnVehicle_mm, 0)],
    ['Nadrozměr', t.oversize ? `ano (${t.oversizeReasons.join(', ')})` : 'ne'],
    ['Přepravní hmotnost', `${fmt(t.mass_kg, 1)} kg`],
    ['Demontované díly', t.demountedParts.join(', ') || '–'],
  ]), '');

  const s = e.sauna;
  out.push('## Sauna', '', table(['', ''], [
    ['Vnitřní objem V', `${fmt(s.innerVolume_m3, 3)} m³`],
    ['Plocha skla', `${fmt(s.glassArea_m2, 2)} m²`],
    ['Nezaizolované plochy', `${fmt(s.uninsulatedArea_m2, 2)} m²`],
    ['Ekvivalentní objem', `${fmt(s.eqVolume_m3, 3)} m³`],
    ['Vhodná kamna', s.suitableHeaters.join(', ')],
    ['Světlá výška kabiny', fmt(s.cabinClearHeight_mm, 0)],
    ['Horní lavice / strop', `${fmt(s.topBench_mm, 0)} / ${fmt(s.topBenchToCeiling_mm, 0)}`],
    ['Elektro', s.electrical ? `${s.electrical.power_kw} kW, ${s.electrical.voltage} V, jistič ${s.electrical.breaker_A} A, ${s.electrical.cable}` : '–'],
  ]), '');

  out.push('## Průstupy', '', table(['Id', 'Druh', 'Plocha', 'Poloha [x; y; z]', 'Rozměr'], e.penetrations.map((p) => [p.id, p.kind, p.surface, v3(p.position_mm), 'diameter_mm' in p.size ? `Ø${p.size.diameter_mm}` : `${p.size.w_mm}×${p.size.h_mm}`])), '');

  out.push('## Automatické doplňky a varování', '');
  for (const a of e.auto) out.push(`- **${a.ruleId}** (auto): ${fillTemplate(a.note, a.params)}`);
  for (const v of e.violations) out.push(`- **${v.ruleId}** (${v.level}): ${fillTemplate(v.message, v.params)}`);
  out.push('');

  const p = e.price;
  out.push('## Cena', '', table(['Kategorie', 'Náklad', 'Cena'], (['steel', 'timber', 'purchased', 'labour', 'transport', 'crane', 'total'] as const).map((k) => [k, fmt(p.cost[k], 0), fmt(p.price[k], 0)])));
  out.push('', `Zobrazení: ${p.display.mode === 'range' ? `${fmt(p.display.from, 0)} – ${fmt(p.display.to, 0)} Kč` : p.display.mode === 'exact' ? `${fmt(p.display.value, 0)} Kč` : 'skryto'}`, '');
  return out.join('\n');
}
