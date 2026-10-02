import { planSvg, type Catalog, type Evaluation, type I18nText, type Locale, type ResolvedLayup } from '@sauna/core';
import type { Tenant } from '../repo.js';

/**
 * HTML for the customer offer and the technical sheet (rendered to PDF by PdfRenderer).
 * Everything is inline (no network in the renderer).
 */

const T = {
  cs: {
    offer: 'Nabídka', tech: 'Technický list pro výrobu', config: 'Konfigurace', revision: 'revize', date: 'Datum', catalog: 'katalog',
    renders: 'Vizualizace', plan: 'Půdorys', choices: 'Souhrn voleb', price: 'Orientační cena', priceHidden: 'Cena na dotaz', exVat: 'bez DPH, vč. dopravy',
    requirements: 'Požadavky na přípojky a osazení', electrical: 'Elektro', chimney: 'Komín', foundation: 'Osazení', transport: 'Doprava', link: 'Konfiguraci otevřete zde',
    module: 'Modul', layout: 'Dispozice', openings: 'Otvory', exterior: 'Exteriér', interior: 'Interiér', extras: 'Doplňky', none: '–', noRenders: 'Vizualizace nebyly přiloženy.',
    sauna: 'sauna', changing: 'převlékárna', cog: 'Těžiště', supports: 'podpěr', maxLoad: 'max. zatížení podpěry', oversize: 'nadrozměrná přeprava', normal: 'běžná přeprava',
    vehicle: 'vozidlo', crane: 'nutný autojeřáb', notes: 'Upozornění', woodHeater: 'izolovaný komín nad střechou (součást dodávky)', disclaimer: 'Cena je orientační, závazná nabídka bude upřesněna po prohlídce místa.',
    mass: 'Hmotnostní list', assembly: 'Sestava', kg: 'kg', cogXYZ: 'Těžiště [x; y; z] mm', empty: 'Prázdná (osazená)', transportMass: 'Přepravní', foundationMass: 'Základy',
    lift: 'Reakce v závěsných bodech', point: 'Bod', position: 'Poloha [mm]', reaction: 'R [kN]', spread: 'Rozptyl (Rmax − Rmin)/Rmean', method: 'Tuhé těleso na stejně tuhých podporách',
    supportsT: 'Body podpěr – vlastní tíha bez užitného zatížení a sněhu', layups: 'Skladby', layer: 'Vrstva', thickness: 'Tl. [mm]', penetrations: 'Průstupy', kind: 'Druh', surface: 'Plocha', size: 'Rozměr',
    tzb: 'TZB', power: 'Příkon', breaker: 'Jistič', cable: 'Kabel', placeholders: 'Použité zástupné hodnoty (ověřit)', warnings: 'Varování a automatické doplňky', dims: 'Rozměry', heightOnVehicle: 'výška na vozidle', demounted: 'demontované díly',
  },
  de: {
    offer: 'Angebot', tech: 'Technisches Datenblatt', config: 'Konfiguration', revision: 'Revision', date: 'Datum', catalog: 'Katalog',
    renders: 'Visualisierung', plan: 'Grundriss', choices: 'Übersicht', price: 'Richtpreis', priceHidden: 'Preis auf Anfrage', exVat: 'zzgl. MwSt., inkl. Transport',
    requirements: 'Anschlüsse und Fundament', electrical: 'Elektro', chimney: 'Kamin', foundation: 'Fundament', transport: 'Transport', link: 'Konfiguration öffnen',
    module: 'Modul', layout: 'Grundriss', openings: 'Öffnungen', exterior: 'Außen', interior: 'Innen', extras: 'Extras', none: '–', noRenders: 'Keine Visualisierung beigefügt.',
    sauna: 'Sauna', changing: 'Umkleide', cog: 'Schwerpunkt', supports: 'Auflager', maxLoad: 'max. Last je Auflager', oversize: 'Sondertransport', normal: 'Standardtransport',
    vehicle: 'Fahrzeug', crane: 'Mobilkran nötig', notes: 'Hinweise', woodHeater: 'isolierter Kamin über Dach (im Lieferumfang)', disclaimer: 'Richtpreis, das verbindliche Angebot folgt nach Besichtigung.',
    mass: 'Gewichtsliste', assembly: 'Baugruppe', kg: 'kg', cogXYZ: 'Schwerpunkt [x; y; z] mm', empty: 'Leer (aufgestellt)', transportMass: 'Transport', foundationMass: 'Fundament',
    lift: 'Reaktionen an Anschlagpunkten', point: 'Punkt', position: 'Lage [mm]', reaction: 'R [kN]', spread: 'Streuung (Rmax − Rmin)/Rmean', method: 'Starrkörper auf gleich steifen Auflagern',
    supportsT: 'Auflager – Eigengewicht ohne Nutz- und Schneelast', layups: 'Aufbauten', layer: 'Schicht', thickness: 'Dicke [mm]', penetrations: 'Durchdringungen', kind: 'Art', surface: 'Fläche', size: 'Größe',
    tzb: 'Haustechnik', power: 'Leistung', breaker: 'Sicherung', cable: 'Kabel', placeholders: 'Platzhalterwerte (prüfen)', warnings: 'Hinweise und automatische Ergänzungen', dims: 'Maße', heightOnVehicle: 'Höhe auf Fahrzeug', demounted: 'demontierte Teile',
  },
  en: {
    offer: 'Offer', tech: 'Technical sheet', config: 'Configuration', revision: 'revision', date: 'Date', catalog: 'catalog',
    renders: 'Renders', plan: 'Plan', choices: 'Summary', price: 'Indicative price', priceHidden: 'Price on request', exVat: 'excl. VAT, incl. delivery',
    requirements: 'Site and connection requirements', electrical: 'Electrical', chimney: 'Chimney', foundation: 'Foundation', transport: 'Delivery', link: 'Open the configuration',
    module: 'Module', layout: 'Layout', openings: 'Openings', exterior: 'Exterior', interior: 'Interior', extras: 'Extras', none: '–', noRenders: 'No renders attached.',
    sauna: 'sauna', changing: 'changing room', cog: 'COG', supports: 'supports', maxLoad: 'max. load per support', oversize: 'oversize transport', normal: 'standard transport',
    vehicle: 'vehicle', crane: 'mobile crane required', notes: 'Notes', woodHeater: 'insulated chimney above the roof (included)', disclaimer: 'Indicative price; the binding offer follows a site visit.',
    mass: 'Mass sheet', assembly: 'Assembly', kg: 'kg', cogXYZ: 'COG [x; y; z] mm', empty: 'Empty (installed)', transportMass: 'Transport', foundationMass: 'Foundation',
    lift: 'Lifting point reactions', point: 'Point', position: 'Position [mm]', reaction: 'R [kN]', spread: 'Spread (Rmax − Rmin)/Rmean', method: 'Rigid body on equally stiff supports',
    supportsT: 'Supports – self weight, no live or snow load', layups: 'Build-ups', layer: 'Layer', thickness: 'Thk. [mm]', penetrations: 'Penetrations', kind: 'Kind', surface: 'Surface', size: 'Size',
    tzb: 'Services', power: 'Power', breaker: 'Breaker', cable: 'Cable', placeholders: 'Placeholder values used (verify)', warnings: 'Warnings and automatic additions', dims: 'Dimensions', heightOnVehicle: 'height on vehicle', demounted: 'demounted parts',
  },
} as const;

type Dict = Record<keyof (typeof T)['cs'], string>;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const nf = (loc: Locale, d = 0) => new Intl.NumberFormat(loc, { maximumFractionDigits: d, minimumFractionDigits: 0 });
const tx = (t: I18nText, loc: Locale) => t[loc] ?? t.en ?? t.cs;
const fill = (s: string, p: Record<string, unknown>, loc: Locale) =>
  s.replace(/\{([^}]+)\}/g, (_, k: string) => {
    const v = p[k];
    return v === null || v === undefined ? '–' : typeof v === 'number' ? nf(loc, 2).format(v) : String(v);
  });

function shell(tenant: Tenant, title: string, body: string): string {
  const th = tenant.settings.theme;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
  @page{size:A4}*{box-sizing:border-box}body{margin:0;font:10.5pt/1.4 ${th.fontFamily};color:#1f1b17}
  header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid ${th.primary};padding-bottom:6px;margin-bottom:12px}
  header .brand{font-size:16pt;font-weight:700;color:${th.primary}}header img{height:34px}h1{font-size:15pt;margin:0}h2{font-size:12pt;margin:16px 0 6px;color:${th.primary}}
  table{width:100%;border-collapse:collapse;font-size:9.5pt}th,td{border-bottom:1px solid #ddd;padding:3px 5px;text-align:left;vertical-align:top}th{background:#f3eee8}td.n,th.n{text-align:right}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}.grid img{width:100%;border-radius:6px}.muted{color:#6f665d}.price{font-size:18pt;font-weight:700}
  .box{border:1px solid #ddd;border-radius:8px;padding:8px 10px}.plan svg{width:100%;height:auto}.warn{color:#8a5a00}.page{page-break-before:always}
  dl{display:grid;grid-template-columns:max-content 1fr;gap:3px 12px;margin:0}dt{color:#6f665d}dd{margin:0}
  </style></head><body><header><div>${th.logoUrl?.startsWith('data:') ? `<img src="${th.logoUrl}" alt="">` : `<span class="brand">${esc(tenant.name)}</span>`}</div><div class="muted">${esc(title)}</div></header>${body}</body></html>`;
}

function names(catalog: Catalog, loc: Locale) {
  const all = [...catalog.panels, ...catalog.heaters, ...catalog.openings, ...catalog.attachmentSystems, ...catalog.foundations, ...catalog.benchSystems, ...catalog.purchased];
  return (sku: string) => {
    const it = all.find((x) => x.sku === sku);
    return it ? tx(it.name, loc) : sku;
  };
}

export interface DocMeta {
  tenant: Tenant;
  catalog: Catalog;
  configId: string;
  revision: number;
  locale: Locale;
  link: string;
  snapshots: Record<string, Buffer>;
  date?: Date;
}

export function offerHtml(ev: Evaluation, m: DocMeta): string {
  const loc = m.locale;
  const t: Dict = T[loc];
  const n = names(m.catalog, loc);
  const c = ev.config;
  const mm = (v: number) => nf(loc, 2).format(v / 1000);
  const money = (v: number) => new Intl.NumberFormat(loc, { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(v);
  const d = ev.price.display;
  const priceHtml = d.mode === 'hidden' ? t.priceHidden : d.mode === 'range' ? `${money(d.from)} – ${money(d.to)}` : money(d.value);
  const views = ['iso_front', 'iso_back', 'front', 'section'].filter((v) => m.snapshots[v]);
  const renders = views.length ? `<div class="grid">${views.map((v) => `<img src="data:image/png;base64,${m.snapshots[v]!.toString('base64')}" alt="${v}">`).join('')}</div>` : `<p class="muted">${t.noRenders}</p>`;
  const plan = planSvg(ev, { variant: 'offer', width: 760, labels: { sauna: t.sauna, changing: t.changing } });
  const maxR = Math.max(...ev.supports.points.map((p) => p.R_kN));
  const heater = m.catalog.heaters.find((h) => h.sku === c.sauna.heater.sku);
  const reqs: string[] = [];
  if (ev.sauna.electrical) reqs.push(`<dt>${t.electrical}</dt><dd>${nf(loc, 1).format(ev.sauna.electrical.power_kw)} kW · ${ev.sauna.electrical.voltage} V · ${t.breaker} ${ev.sauna.electrical.breaker_A} A · ${esc(ev.sauna.electrical.cable)}</dd>`);
  if (heater?.fuel === 'wood') reqs.push(`<dt>${t.chimney}</dt><dd>${t.woodHeater}</dd>`);
  reqs.push(`<dt>${t.foundation}</dt><dd>${esc(n(m.catalog.foundations.find((f) => f.type === c.foundation)?.sku ?? ''))}: ${ev.supports.points.length} ${t.supports}, ${t.maxLoad} ${nf(loc, 1).format(maxR)} kN</dd>`);
  reqs.push(`<dt>${t.transport}</dt><dd>${ev.transport.oversize ? t.oversize : t.normal}; ${t.dims} ${mm(ev.transport.length_mm)} × ${mm(ev.transport.width_mm)} × ${mm(ev.transport.height_mm)} m${ev.transport.needsMobileCrane ? `; ${t.crane}` : ''}</dd>`);
  const warnings = ev.violations.filter((v) => v.level === 'warning');
  const body = `
  <h1>${t.offer} · ${esc(m.tenant.name)}</h1>
  <p class="muted">${t.config} ${esc(m.configId)} · ${t.revision} ${m.revision} · ${t.date} ${(m.date ?? new Date()).toLocaleDateString(loc)}</p>
  <h2>${t.renders}</h2>${renders}
  <div class="box" style="margin-top:10px"><div class="muted">${t.price}</div><div class="price">${priceHtml}</div>${d.mode !== 'hidden' ? `<div class="muted">${t.exVat}. ${t.disclaimer}</div>` : ''}</div>
  <h2 class="page">${t.plan}</h2><div class="plan">${plan}</div>
  <h2>${t.choices}</h2><dl>
    <dt>${t.module}</dt><dd>${mm(c.module.L_mm)} × ${mm(c.module.W_mm)} × ${mm(c.module.H_mm)} m (${c.module.type === 'iso_20hc' ? 'ISO 20′ HC' : 'custom'})</dd>
    <dt>${t.layout}</dt><dd>${c.zones.map((z) => `${z.type === 'sauna' ? t.sauna : t.changing} ${mm(z.to_mm - z.from_mm)} m`).join(' · ')}</dd>
    <dt>${t.openings}</dt><dd>${c.openings.map((o) => esc(n(o.sku))).join(', ') || t.none}</dd>
    <dt>${t.exterior}</dt><dd>${esc(n(c.cladding.exterior))}, ${esc(n(c.cladding.roof))}</dd>
    <dt>${t.interior}</dt><dd>${esc(n(c.sauna.interiorCladding))}; ${esc(n(c.sauna.heater.sku))}; ${esc(n(c.sauna.benches.system))} (${c.sauna.benches.layout}, ${c.sauna.benches.levels})</dd>
    <dt>${t.extras}</dt><dd>${c.attachments.map((a) => esc(n(a.sku))).join(', ') || t.none}</dd>
  </dl>
  <h2>${t.requirements}</h2><dl>${reqs.join('')}</dl>
  ${warnings.length ? `<h2>${t.notes}</h2><ul>${warnings.map((w) => `<li class="warn">${esc(fill(tx(w.message, loc), w.params, loc))}</li>`).join('')}</ul>` : ''}
  <p style="margin-top:14px">${t.link}: <a href="${esc(m.link)}">${esc(m.link)}</a></p>`;
  return shell(m.tenant, `${t.offer} ${m.configId}/${m.revision}`, body);
}

export function techHtml(ev: Evaluation, m: DocMeta): string {
  const loc = m.locale;
  const t: Dict = T[loc];
  const n0 = nf(loc, 0);
  const n1 = nf(loc, 1);
  const n2 = nf(loc, 2);
  const xyz = (v: readonly number[]) => `${n0.format(v[0]!)}; ${n0.format(v[1]!)}; ${n0.format(v[2]!)}`;
  const mass = ev.mass;
  const plan = planSvg(ev, { variant: 'tech', width: 760, labels: { sauna: t.sauna, changing: t.changing, cog: t.cog } });
  const layupRows = (name: string, l: ResolvedLayup) =>
    l.layers
      .map((x, i) => `<tr><td>${i === 0 ? `${esc(name)} (${esc(l.sku)}, ${n0.format(l.total_mm)} mm)` : ''}</td><td>${x.kind}${x.sku ? ` · ${esc(x.sku)}` : ''}${x.fill ? ` + ${esc(x.fill)}` : ''}${x.spacing_mm ? ` @ ${x.spacing_mm}` : ''}</td><td class="n">${n1.format(x.thickness_mm)}</td></tr>`)
      .join('');
  // Placeholder catalog values used by this configuration.
  const used = new Set(ev.bomRows.map((r) => r.sku));
  const placeholders = [
    ...m.catalog.heaters, ...m.catalog.openings, ...m.catalog.panels, ...m.catalog.containers, ...m.catalog.layups, ...m.catalog.frameRecipes, ...m.catalog.foundations, ...m.catalog.benchSystems, ...m.catalog.purchased, ...m.catalog.attachmentSystems, ...m.catalog.timber,
  ].filter(
    (x) =>
      x.source?.placeholder &&
      (used.has(x.sku) || Object.values(ev.geometry.layups).some((l) => l.sku === x.sku) || (x.kind === 'frame_recipe' && x.moduleType === ev.config.module.type)),
  );
  const body = `
  <h1>${t.tech}</h1>
  <p class="muted">${esc(m.tenant.name)} · ${t.config} ${esc(m.configId)} · ${t.revision} ${m.revision} · ${t.catalog} ${esc(ev.catalogVersion)} · ${t.date} ${(m.date ?? new Date()).toLocaleDateString(loc)}</p>
  <h2>${t.mass}</h2>
  <table><tr><th>${t.assembly}</th><th class="n">${t.kg}</th><th class="n">${t.cogXYZ}</th></tr>
  ${Object.entries(mass.byAssembly).map(([a, v]) => `<tr><td>${a}</td><td class="n">${n1.format(v!.mass_kg)}</td><td class="n">${xyz(v!.cog_mm)}</td></tr>`).join('')}
  <tr><th>${t.empty}</th><th class="n">${n1.format(mass.empty_kg)}</th><th class="n">${xyz(mass.empty_cog_mm)}</th></tr>
  <tr><th>${t.transportMass}</th><th class="n">${n1.format(mass.transport_kg)}</th><th class="n">${xyz(mass.transport_cog_mm)}</th></tr>
  <tr><td>${t.foundationMass}</td><td class="n">${n1.format(mass.foundation_kg)}</td><td></td></tr></table>
  <h2>${t.lift}</h2>
  <p class="muted">${t.method}; G = ${n2.format(ev.lift.load_kN)} kN; ${t.spread} ${n1.format(ev.lift.spread * 100)} %${ev.lift.warn ? ' ⚠' : ''}</p>
  <table><tr><th>${t.point}</th><th class="n">${t.position}</th><th class="n">${t.reaction}</th></tr>${ev.lift.points.map((p) => `<tr><td>${p.id}</td><td class="n">${xyz(p.position_mm)}</td><td class="n">${n2.format(p.R_kN)}</td></tr>`).join('')}</table>
  <div class="plan" style="margin-top:8px">${plan}</div>
  <h2 class="page">${t.supportsT}</h2>
  <table><tr><th>${t.point}</th><th class="n">${t.position}</th><th class="n">${t.reaction}</th></tr>${ev.supports.points.map((p) => `<tr><td>${p.id}</td><td class="n">${n0.format(p.position_mm[0])}; ${n0.format(p.position_mm[1])}</td><td class="n">${n2.format(p.R_kN)}</td></tr>`).join('')}</table>
  <h2>${t.transport}</h2><dl>
    <dt>${t.dims}</dt><dd>${n0.format(ev.transport.length_mm)} × ${n0.format(ev.transport.width_mm)} × ${n0.format(ev.transport.height_mm)} mm</dd>
    <dt>${t.vehicle}</dt><dd>${esc(ev.transport.vehicleId)}${ev.transport.needsMobileCrane ? ` + ${t.crane}` : ''}; ${t.heightOnVehicle} ${n0.format(ev.transport.heightOnVehicle_mm)} mm</dd>
    <dt>${t.oversize}</dt><dd>${ev.transport.oversize ? ev.transport.oversizeReasons.join(', ') : '–'}</dd>
    <dt>${t.demounted}</dt><dd>${ev.transport.demountedParts.map(esc).join(', ') || '–'}</dd></dl>
  <h2>${t.layups}</h2>
  <table><tr><th></th><th>${t.layer}</th><th class="n">${t.thickness}</th></tr>${layupRows('wall', ev.geometry.layups.wall)}${layupRows('roof', ev.geometry.layups.roof)}${layupRows('floor', ev.geometry.layups.floor)}${ev.geometry.partitions.length ? layupRows('partition', ev.geometry.layups.partition) : ''}</table>
  <h2>${t.penetrations}</h2>
  <table><tr><th>Id</th><th>${t.kind}</th><th>${t.surface}</th><th class="n">${t.position}</th><th class="n">${t.size}</th></tr>${ev.penetrations.map((p) => `<tr><td>${p.id}</td><td>${p.kind}</td><td>${p.surface}</td><td class="n">${xyz(p.position_mm)}</td><td class="n">${'diameter_mm' in p.size ? `Ø${p.size.diameter_mm}` : `${p.size.w_mm}×${p.size.h_mm}`}</td></tr>`).join('')}</table>
  <h2>${t.tzb}</h2>
  ${ev.sauna.electrical ? `<dl><dt>${t.power}</dt><dd>${n1.format(ev.sauna.electrical.power_kw)} kW / ${ev.sauna.electrical.voltage} V</dd><dt>${t.breaker}</dt><dd>${ev.sauna.electrical.breaker_A} A</dd><dt>${t.cable}</dt><dd>${esc(ev.sauna.electrical.cable)}</dd></dl>` : '<p>–</p>'}
  <h2>${t.warnings}</h2><ul>
  ${ev.violations.map((v) => `<li class="warn">${v.ruleId}: ${esc(fill(tx(v.message, loc), v.params, loc))}</li>`).join('')}
  ${ev.auto.map((a) => `<li>${a.ruleId}: ${esc(fill(tx(a.note, loc), a.params, loc))}</li>`).join('')}</ul>
  ${placeholders.length ? `<h2>${t.placeholders}</h2><ul>${placeholders.map((x) => `<li>${esc(x.sku)} – ${esc(x.source!.ref)}</li>`).join('')}</ul>` : ''}`;
  return shell(m.tenant, `${t.tech} ${m.configId}/${m.revision}`, body);
}
