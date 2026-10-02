import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { defaultConfig } from '@sauna/core';
import { DEMO_CATALOG } from '@sauna/core/fixtures';
import { drain } from '../src/services/jobs.js';
import { login, multipart, setup, type Ctx } from './helpers.js';

/**
 * M6: systematic tenant isolation (D-042). Tenant A ("demo") owns a config, a lead and files;
 * every route is called with A's ids from tenant B ("other") – public (wrong ?tenant) and
 * admin (B's session). Nothing of A may leak: 404 or an empty list, never A's data.
 */
let ctx: Ctx;
const A: { configId: string; leadId: string; fileIds: string[] } = { configId: '', leadId: '', fileIds: [] };
let bAdmin = '';

beforeAll(async () => {
  ctx = await setup();
  const fd = new FormData();
  fd.set('payload', JSON.stringify({ tenant: 'demo', config: defaultConfig(DEMO_CATALOG), contact: { name: 'Tajný Zákazník', email: 'secret@example.com', postalCode: '11000', consent: true } }));
  fd.set('photo', new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')], { type: 'image/png' }), 'p.png');
  const r = await ctx.app.inject({ method: 'POST', url: '/leads', ...(await multipart(fd)) });
  A.configId = r.json().configId;
  A.leadId = r.json().leadId;
  await drain({ db: ctx.db, mailer: ctx.mailer, pdf: ctx.pdf, cfg: ctx.cfg });
  A.fileIds = (await ctx.db.query.files.findMany({ where: (f, { eq }) => eq(f.tenantId, ctx.demo.id) })).map((f) => f.id);
  bAdmin = await login(ctx, 'other', 'admin@other.example');
});
afterAll(async () => ctx?.close());

const leaks = (body: string) => body.includes('Tajný') || body.includes('secret@example.com') || body.includes(A.leadId);

describe('public routes with tenant B', () => {
  const cases: Array<[string, () => { method: 'GET' | 'PUT' | 'POST'; url: string; payload?: unknown }]> = [
    ['GET /configs/:id', () => ({ method: 'GET', url: `/configs/${A.configId}?tenant=other` })],
    ['GET /configs/:id revision', () => ({ method: 'GET', url: `/configs/${A.configId}?tenant=other&revision=1` })],
    ['PUT /configs/:id', () => ({ method: 'PUT', url: `/configs/${A.configId}?tenant=other`, payload: { ...defaultConfig(DEMO_CATALOG), tenantId: 'other' } })],
    ['PUT /configs/:id (A payload, B tenant)', () => ({ method: 'PUT', url: `/configs/${A.configId}?tenant=other`, payload: defaultConfig(DEMO_CATALOG) })],
  ];
  it.each(cases)('%s → 404', async (_n, mk) => {
    const c = mk();
    const r = await ctx.app.inject({ method: c.method, url: c.url, ...(c.payload ? { payload: c.payload as Record<string, unknown> } : {}) });
    expect(r.statusCode).toBe(404);
    expect(leaks(r.body)).toBe(false);
  });

  it('a lead for B cannot append a revision to A\'s config', async () => {
    const cfg = { ...defaultConfig(DEMO_CATALOG), tenantId: 'other', id: A.configId };
    const fd = new FormData();
    fd.set('payload', JSON.stringify({ tenant: 'other', config: cfg, contact: { name: 'Bob', email: 'b@example.com', postalCode: '11000', consent: true } }));
    const r = await ctx.app.inject({ method: 'POST', url: '/leads', ...(await multipart(fd)) });
    expect(r.statusCode).toBe(201);
    expect(r.json().configId).not.toBe(A.configId); // new config for B
    const head = await ctx.db.query.configs.findFirst({ where: (c, { eq }) => eq(c.id, A.configId) });
    expect(head!.currentRevision).toBe(1);
  });
});

describe('admin routes with B session and A ids', () => {
  const routes: Array<[string, () => { method: 'GET' | 'PATCH'; url: string; payload?: unknown }]> = [
    ['lead', () => ({ method: 'GET', url: `/admin/leads/${A.leadId}` })],
    ['lead detail', () => ({ method: 'GET', url: `/admin/leads/${A.leadId}/detail` })],
    ['lead status', () => ({ method: 'PATCH', url: `/admin/leads/${A.leadId}`, payload: { status: 'lost' } })],
    ...(['bom.csv', 'bom.xlsx', 'config.json', 'offer.pdf', 'tech.pdf'] as const).map((n) => [`export ${n}`, () => ({ method: 'GET' as const, url: `/configs/${A.configId}/exports/${n}` })] as [string, () => { method: 'GET'; url: string }]),
    ['export ?tenant=demo', () => ({ method: 'GET', url: `/configs/${A.configId}/exports/offer.pdf?tenant=demo` })],
    ['catalog version of A', () => ({ method: 'GET', url: `/admin/catalog?version=demo-1` })],
    ['catalog XLSX version of A', () => ({ method: 'GET', url: `/admin/catalog/export.xlsx?version=demo-1` })],
  ];
  it.each(routes)('%s → 404', async (_n, mk) => {
    const c = mk();
    const r = await ctx.app.inject({ method: c.method, url: c.url, headers: { cookie: bAdmin }, ...(c.payload ? { payload: c.payload as Record<string, unknown> } : {}) });
    expect(r.statusCode).toBe(404);
    expect(leaks(r.body)).toBe(false);
  });

  it('files of A → 404', async () => {
    expect(A.fileIds.length).toBeGreaterThanOrEqual(4); // photo + 2 PDF + XLSX
    for (const id of A.fileIds) expect((await ctx.app.inject({ url: `/admin/files/${id}`, headers: { cookie: bAdmin } })).statusCode).toBe(404);
  });

  it('lists only contain B data', async () => {
    const leads = await ctx.app.inject({ url: '/admin/leads', headers: { cookie: bAdmin } });
    expect(leaks(leads.body)).toBe(false);
    expect(leads.json().every((l: { tenantId: string }) => l.tenantId === ctx.other.id)).toBe(true);
    expect((await ctx.app.inject({ url: `/admin/configs/${A.configId}/revisions`, headers: { cookie: bAdmin } })).json()).toEqual([]);
    const t = (await ctx.app.inject({ url: '/admin/tenant', headers: { cookie: bAdmin } })).json();
    expect(t.slug).toBe('other');
    expect(t.versions.every((v: { version: string }) => v.version.startsWith('other'))).toBe(true);
  });

  it('A\'s lead is unchanged after B\'s attempts', async () => {
    const l = await ctx.db.query.leads.findFirst({ where: (x, { eq }) => eq(x.id, A.leadId) });
    expect(l!.status).toBe('new');
  });

  it('B publishing a catalog does not touch A', async () => {
    const c = (await ctx.app.inject({ url: '/admin/catalog', headers: { cookie: bAdmin } })).json();
    c.heaters[0].cost = 1;
    const r = await ctx.app.inject({ method: 'POST', url: '/admin/catalog', headers: { cookie: bAdmin }, payload: { catalog: { ...c, tenantId: 'demo' } } });
    expect(r.statusCode).toBe(201);
    expect(r.json().version).toMatch(/^other-/);
    const pubA = (await ctx.app.inject({ url: '/tenants/demo/public' })).json();
    expect(pubA.catalog.version).toBe('demo-1');
    expect(pubA.catalog.heaters[0].cost).not.toBe(1);
  });
});

describe('every tenant table query is scoped', () => {
  it('rows of all tenant tables carry tenant_id (no NULLs)', async () => {
    for (const table of ['configs', 'config_revisions', 'files', 'leads', 'users', 'jobs', 'catalog_versions']) {
      const r = (await ctx.db.execute(`SELECT count(*)::int AS n FROM ${table} WHERE tenant_id IS NULL` as never)) as unknown as { rows: Array<{ n: number }> };
      expect(r.rows[0]!.n).toBe(0);
    }
  });
});
