import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { defaultConfig, type Catalog } from '@sauna/core';
import { DEMO_CATALOG, REFERENCE_CONFIGS } from '@sauna/core/fixtures';
import { drain } from '../src/services/jobs.js';
import { login, multipart, setup, type Ctx } from './helpers.js';

let ctx: Ctx;
let admin = '';
let sales = '';
let oldConfigId = '';
beforeAll(async () => {
  ctx = await setup();
  admin = await login(ctx, 'demo', 'admin@demo-sauny.example');
  sales = await login(ctx, 'demo', 'sales@demo-sauny.example');
  oldConfigId = (await ctx.app.inject({ method: 'POST', url: '/configs', payload: REFERENCE_CONFIGS['REF-1 – custom 2,3 × 4,2 m, kamna na dřevo'] })).json().id;
});
afterAll(async () => ctx?.close());

const json = (cookie: string, method: 'GET' | 'POST' | 'PATCH', url: string, payload?: unknown) => ctx.app.inject({ method, url, headers: { cookie }, ...(payload !== undefined ? { payload: payload as Record<string, unknown> } : {}) });

describe('tenant settings', () => {
  it('sales can read, the webhook secret is never returned', async () => {
    const r = await json(sales, 'GET', '/admin/tenant');
    expect(r.statusCode).toBe(200);
    expect(r.json().settings.hasWebhookSecret).toBe(true);
    expect(r.body).not.toContain('s3cret');
    expect(r.json().role).toBe('sales');
  });
  it('only admin can change settings; theming shows up in the public endpoint', async () => {
    expect((await json(sales, 'PATCH', '/admin/tenant', { theme: { ...ctx.demo.settings.theme, primary: '#123456' } })).statusCode).toBe(403);
    const r = await json(admin, 'PATCH', '/admin/tenant', { name: 'Demo Sauny s.r.o.', theme: { ...ctx.demo.settings.theme, primary: '#123456' }, locales: ['cs', 'de'], webhookSecret: '' });
    expect(r.statusCode).toBe(200);
    const pub = (await ctx.app.inject({ url: '/tenants/demo/public' })).json();
    expect(pub.theme.primary).toBe('#123456');
    expect(pub.locales).toEqual(['cs', 'de']);
    expect((await json(sales, 'GET', '/admin/tenant')).json().settings.hasWebhookSecret).toBe(true); // empty = keep
  });
  it('rejects invalid input', async () => {
    expect((await json(admin, 'PATCH', '/admin/tenant', { theme: { ...ctx.demo.settings.theme, primary: 'red' } })).statusCode).toBe(400);
    expect((await json(admin, 'PATCH', '/admin/tenant', { defaultLocale: 'en' })).statusCode).toBe(400); // en not in locales anymore
    expect((await json(admin, 'PATCH', '/admin/tenant', { theme: { ...ctx.demo.settings.theme, logoUrl: 'javascript:alert(1)' } })).statusCode).toBe(400);
  });
});

describe('catalog versions', () => {
  const current = async () => (await json(sales, 'GET', '/admin/catalog')).json() as Catalog;

  it('dry run shows the diff without publishing', async () => {
    const c = await current();
    c.heaters[0]!.cost = 25000;
    const r = await json(admin, 'POST', '/admin/catalog', { catalog: c, dryRun: true });
    expect(r.statusCode).toBe(200);
    expect(r.json().diff.lists.heaters.changed).toEqual(['HEATER-WOOD-A']);
    expect((await current()).version).toBe('demo-1');
  });

  it('publishing creates an immutable version; public prices follow; old revisions keep their version', async () => {
    const c = await current();
    c.heaters[0]!.cost = 25000;
    expect((await json(sales, 'POST', '/admin/catalog', { catalog: c })).statusCode).toBe(403);
    const r = await json(admin, 'POST', '/admin/catalog', { catalog: c });
    expect(r.statusCode).toBe(201);
    expect(r.json().version).toBe('demo-2');
    const pub = (await ctx.app.inject({ url: '/tenants/demo/public' })).json();
    expect(pub.catalog.version).toBe('demo-2');
    expect(pub.catalog.heaters[0].cost).toBeCloseTo(25000 * (1 + DEMO_CATALOG.rates.margin.purchased), 6);
    const old = (await ctx.app.inject({ url: `/configs/${oldConfigId}/exports/config.json`, headers: { cookie: sales } })).json();
    expect(old.catalogVersion).toBe('demo-1');
    const tenant = (await json(sales, 'GET', '/admin/tenant')).json();
    expect(tenant.versions.map((v: { version: string }) => v.version)).toEqual(['demo-2', 'demo-1']);
  });

  it('invalid catalog → 422 with issues, nothing published', async () => {
    const c = await current();
    c.profiles[0]!.material = 'NOPE';
    const r = await json(admin, 'POST', '/admin/catalog', { catalog: c });
    expect(r.statusCode).toBe(422);
    expect(r.json().issues.some((i: { path: string }) => i.path === 'profiles[0].material')).toBe(true);
    expect((await current()).version).toBe('demo-2');
  });

  it('a new heater added in the admin is usable in configurations without code changes', async () => {
    const c = await current();
    c.heaters.push({ ...c.heaters[2]!, sku: 'HEATER-EL-NEW', name: { cs: 'Nová elektrická kamna 12 kW' }, power_kw: 12, volume_min_m3: 10, volume_max_m3: 20 });
    expect((await json(admin, 'POST', '/admin/catalog', { catalog: c })).statusCode).toBe(201);
    const pub = (await ctx.app.inject({ url: '/tenants/demo/public' })).json() as Catalog & { catalog: Catalog };
    expect(pub.catalog.heaters.some((h) => h.sku === 'HEATER-EL-NEW')).toBe(true);
    const cfg = defaultConfig(pub.catalog);
    cfg.sauna.heater.sku = 'HEATER-EL-NEW';
    const r = await ctx.app.inject({ method: 'POST', url: '/configs', payload: cfg });
    expect(r.statusCode).toBe(201);
    expect(r.json().config.sauna.heater.sku).toBe('HEATER-EL-NEW');
    expect(r.json().sauna.electrical.breaker_A).toBeGreaterThan(0);
  });

  it('malformed multipart → 400, not 500', async () => {
    const r = await ctx.app.inject({ method: 'POST', url: '/admin/catalog/import', headers: { cookie: admin, 'content-type': 'multipart/form-data; boundary=x' }, payload: '--y\r\nbroken' });
    expect(r.statusCode).toBeGreaterThanOrEqual(400);
    expect(r.statusCode).toBeLessThan(500);
  });

  it('XLSX export → edit → import (dry run, then publish)', async () => {
    const x = await ctx.app.inject({ url: '/admin/catalog/export.xlsx', headers: { cookie: sales } });
    expect(x.statusCode).toBe(200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(x.rawPayload as unknown as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(expect.arrayContaining(['Kamna', 'Profily', 'Okna a dveře', 'Sazby']));
    const rates = wb.getWorksheet('Sazby')!;
    rates.eachRow((row) => {
      if (row.getCell(1).value === 'labour_per_h') row.getCell(2).value = 720;
    });
    const fd = new FormData();
    fd.set('file', new Blob([Buffer.from(await wb.xlsx.writeBuffer())]), 'katalog.xlsx');
    fd.set('dryRun', '1');
    const md = await multipart(fd);
    const dry = await ctx.app.inject({ method: 'POST', url: '/admin/catalog/import', headers: { cookie: admin, ...md.headers }, payload: md.payload });
    expect(dry.statusCode).toBe(200);
    expect(dry.json().diff.settings).toEqual(['rates']);
    expect(dry.json().diff.lists).toEqual({});
    fd.delete('dryRun');
    const m = await multipart(fd);
    const pub = await ctx.app.inject({ method: 'POST', url: '/admin/catalog/import', headers: { cookie: admin, ...m.headers }, payload: m.payload });
    expect(pub.statusCode).toBe(201);
    expect((await current()).rates.labour_per_h).toBe(720);
  });
});

describe('lead detail', () => {
  it('returns contact, evaluation with cost, files and revisions', async () => {
    const fd = new FormData();
    fd.set('payload', JSON.stringify({ tenant: 'demo', config: defaultConfig(DEMO_CATALOG), contact: { name: 'Eva Malá', email: 'eva@example.com', postalCode: '11000', consent: true } }));
    const r = await ctx.app.inject({ method: 'POST', url: '/leads', ...(await multipart(fd)) });
    expect(r.statusCode).toBe(201);
    await drain({ db: ctx.db, mailer: ctx.mailer, pdf: ctx.pdf, cfg: ctx.cfg });
    const d = (await json(sales, 'GET', `/admin/leads/${r.json().leadId}/detail`)).json();
    expect(d.lead.contact.name).toBe('Eva Malá');
    expect(d.evaluation.price.cost).toBeLessThan(d.evaluation.price.total);
    expect(d.files.map((f: { kind: string }) => f.kind).sort()).toEqual(['bom_xlsx', 'offer_pdf', 'tech_pdf']);
    expect(d.link).toContain(`c=${r.json().configId}`);
    const other = await login(ctx, 'other', 'admin@other.example');
    expect((await json(other, 'GET', `/admin/leads/${r.json().leadId}/detail`)).statusCode).toBe(404);
  });
});
