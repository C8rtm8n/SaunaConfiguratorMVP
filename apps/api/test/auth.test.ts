import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { REFERENCE_CONFIGS } from '@sauna/core/fixtures';
import { defaultConfig } from '@sauna/core';
import { DEMO_CATALOG } from '@sauna/core/fixtures';
import { drain } from '../src/services/jobs.js';
import { login, multipart, setup, type Ctx } from './helpers.js';

let ctx: Ctx;
let demoCfg = '';
let otherCfg = '';
beforeAll(async () => {
  ctx = await setup();
  const ref = REFERENCE_CONFIGS['REF-1 – custom 2,3 × 4,2 m, kamna na dřevo'];
  demoCfg = (await ctx.app.inject({ method: 'POST', url: '/configs', payload: ref })).json().id;
  otherCfg = (await ctx.app.inject({ method: 'POST', url: '/configs', payload: { ...ref, tenantId: 'other' } })).json().id;
  // A demo lead with generated files, so isolation checks cover leads and files.
  const fd = new FormData();
  fd.set('payload', JSON.stringify({ tenant: 'demo', config: defaultConfig(DEMO_CATALOG), contact: { name: 'Eva', email: 'eva@example.com', postalCode: '11000', consent: true } }));
  const r = await ctx.app.inject({ method: 'POST', url: '/leads', ...(await multipart(fd)) });
  if (r.statusCode !== 201) throw new Error(r.body);
  await drain({ db: ctx.db, mailer: ctx.mailer, pdf: ctx.pdf, cfg: ctx.cfg });
});
afterAll(async () => ctx?.close());

describe('magic link auth', () => {
  it('unknown e-mails get the same answer and no mail', async () => {
    const n = ctx.mailer.outbox.length;
    const r = await ctx.app.inject({ method: 'POST', url: '/auth/magic-link', payload: { tenant: 'demo', email: 'nobody@example.com' } });
    expect(r.statusCode).toBe(204);
    expect(ctx.mailer.outbox.length).toBe(n);
  });
  it('link logs in once, sets an httpOnly session cookie; reuse fails', async () => {
    const n = ctx.mailer.outbox.length;
    await ctx.app.inject({ method: 'POST', url: '/auth/magic-link', payload: { tenant: 'demo', email: 'ADMIN@demo-sauny.example' } });
    const token = /token=([\w-]+)/.exec(ctx.mailer.outbox[n]!.text)![1]!;
    const v = await ctx.app.inject({ url: `/auth/verify?token=${token}` });
    expect(v.statusCode).toBe(302);
    expect(v.headers.location).toBe('http://admin.test');
    expect(String(v.headers['set-cookie'])).toMatch(/HttpOnly/i);
    expect(String(v.headers['set-cookie'])).toMatch(/SameSite=Lax/i);
    const cookie = String(v.headers['set-cookie']).split(';')[0]!;
    const me = await ctx.app.inject({ url: '/auth/me', headers: { cookie } });
    expect(me.json()).toMatchObject({ email: 'admin@demo-sauny.example', role: 'admin', tenant: { slug: 'demo' } });
    expect((await ctx.app.inject({ url: `/auth/verify?token=${token}` })).statusCode).toBe(401);
    await ctx.app.inject({ method: 'POST', url: '/auth/logout', headers: { cookie } });
    expect((await ctx.app.inject({ url: '/auth/me', headers: { cookie } })).statusCode).toBe(401);
  });
});

describe('exports (admin only)', () => {
  it('require a session', async () => {
    expect((await ctx.app.inject({ url: `/configs/${demoCfg}/exports/bom.csv` })).statusCode).toBe(401);
  });

  it('all formats for the own tenant', async () => {
    const cookie = await login(ctx, 'demo', 'sales@demo-sauny.example');
    const get = (n: string) => ctx.app.inject({ url: `/configs/${demoCfg}/exports/${n}`, headers: { cookie } });
    const csv = await get('bom.csv');
    expect(csv.statusCode).toBe(200);
    expect(csv.body.replace('﻿', '').split('\r\n')[0]).toContain('pozice;kategorie;sestava');
    const xlsx = await get('bom.xlsx');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(xlsx.rawPayload as unknown as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Ocel', 'Dřevo a plášť', 'Nakupované díly', 'Souhrn hmotností']);
    const json = (await get('config.json')).json();
    expect(json.schemaVersion).toBe(1);
    expect(json.outputs.mass.empty_kg).toBeGreaterThan(1000);
    for (const pdf of ['offer.pdf', 'tech.pdf']) {
      const r = await get(pdf);
      expect(r.headers['content-type']).toBe('application/pdf');
      expect(r.rawPayload.subarray(0, 4).toString()).toBe('%PDF');
    }
    expect((await get('evil.sh')).statusCode).toBe(404);
  });
});

describe('tenant isolation', () => {
  it('another tenant cannot export, list or read leads/files of demo', async () => {
    const cookie = await login(ctx, 'other', 'admin@other.example');
    expect((await ctx.app.inject({ url: `/configs/${demoCfg}/exports/bom.csv`, headers: { cookie } })).statusCode).toBe(404);
    expect((await ctx.app.inject({ url: `/configs/${otherCfg}/exports/bom.csv`, headers: { cookie } })).statusCode).toBe(200);
    expect((await ctx.app.inject({ url: `/admin/configs/${demoCfg}/revisions`, headers: { cookie } })).json()).toEqual([]);
    const demoLead = (await ctx.db.query.leads.findFirst({ where: (l, { eq }) => eq(l.tenantId, ctx.demo.id) }))!;
    expect(demoLead.offerPdfFileId).toBeTruthy();
    const list = (await ctx.app.inject({ url: '/admin/leads', headers: { cookie } })).json();
    expect(list.every((l: { tenantId: string }) => l.tenantId === ctx.other.id)).toBe(true);
    expect((await ctx.app.inject({ url: `/admin/leads/${demoLead.id}`, headers: { cookie } })).statusCode).toBe(404);
    expect((await ctx.app.inject({ method: 'PATCH', url: `/admin/leads/${demoLead.id}`, headers: { cookie }, payload: { status: 'won' } })).statusCode).toBe(404);
    expect((await ctx.app.inject({ url: `/admin/files/${demoLead.offerPdfFileId}`, headers: { cookie } })).statusCode).toBe(404);
    // …while the demo sales user can.
    const own = await login(ctx, 'demo', 'sales@demo-sauny.example');
    expect((await ctx.app.inject({ url: `/admin/files/${demoLead.offerPdfFileId}`, headers: { cookie: own } })).statusCode).toBe(200);
    expect((await ctx.app.inject({ method: 'PATCH', url: `/admin/leads/${demoLead.id}`, headers: { cookie: own }, payload: { status: 'negotiating' } })).statusCode).toBe(200);
  });

  it('a session of tenant A is not accepted as tenant B by switching the query', async () => {
    const cookie = await login(ctx, 'other', 'admin@other.example');
    expect((await ctx.app.inject({ url: `/configs/${demoCfg}/exports/offer.pdf?tenant=demo`, headers: { cookie } })).statusCode).toBe(404);
  });

  it('magic link for an e-mail of tenant A cannot log into tenant B', async () => {
    const n = ctx.mailer.outbox.length;
    await ctx.app.inject({ method: 'POST', url: '/auth/magic-link', payload: { tenant: 'other', email: 'admin@demo-sauny.example' } });
    expect(ctx.mailer.outbox.length).toBe(n);
  });
});
