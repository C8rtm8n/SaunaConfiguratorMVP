import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { defaultConfig, evaluate, toPublicCatalog, type SaunaConfig } from '@sauna/core';
import { DEMO_CATALOG, REFERENCE_CONFIGS } from '@sauna/core/fixtures';
import { drain, verifyWebhook } from '../src/services/jobs.js';
import { multipart, setup, type Ctx } from './helpers.js';

let ctx: Ctx;
beforeAll(async () => {
  ctx = await setup();
});
afterAll(async () => ctx?.close());

const REF2 = REFERENCE_CONFIGS['REF-2 – custom 2,3 × 6 m, 2 zóny, terasa'] as SaunaConfig;
const contact = { name: 'Jan Novák', email: 'jan@example.com', phone: '+420 777 000 111', postalCode: '602 00', term: 'jaro', budget: '600 tis.', note: 'svah', consent: true };

describe('public tenant endpoint', () => {
  it('returns theming and a sell-price catalog without costs or margins', async () => {
    const r = await ctx.app.inject({ url: '/tenants/demo/public' });
    expect(r.statusCode).toBe(200);
    const t = r.json();
    expect(t.name).toBe('Demo Sauny s.r.o.');
    expect(t.catalog.pricing).toBe('sell');
    expect(Object.values(t.catalog.rates.margin).every((m) => m === 0)).toBe(true);
    expect(t.catalog.heaters[0].cost).not.toBe(DEMO_CATALOG.heaters[0]!.cost);
    expect(JSON.stringify(t)).not.toContain('notifyEmail');
    expect(JSON.stringify(t)).not.toContain('webhook');
    expect((await ctx.app.inject({ url: '/tenants/nope/public' })).statusCode).toBe(404);
  });
});

describe('configs: server recompute and revisions', () => {
  let id = '';
  it('POST creates revision 1; server price = client price (same core)', async () => {
    const r = await ctx.app.inject({ method: 'POST', url: '/configs', payload: REF2 });
    expect(r.statusCode).toBe(201);
    const body = r.json();
    id = body.id;
    expect(body.revision).toBe(1);
    const client = evaluate(REF2, toPublicCatalog(DEMO_CATALOG));
    expect(body.price.total).toBe(Math.round(client.price.total));
    expect(body.price.display).toEqual(client.price.display);
    expect(JSON.stringify(body)).not.toMatch(/"cost"/);
    expect(body.submittable).toBe(true);
  });

  it('PUT appends a revision; GET returns the latest or a given revision', async () => {
    const changed = { ...REF2, module: { ...REF2.module, L_mm: 5400 } };
    const r = await ctx.app.inject({ method: 'PUT', url: `/configs/${id}?tenant=demo`, payload: changed });
    expect(r.statusCode).toBe(200);
    expect(r.json().revision).toBe(2);
    const latest = (await ctx.app.inject({ url: `/configs/${id}?tenant=demo` })).json();
    expect(latest.config.module.L_mm).toBe(5400);
    const first = (await ctx.app.inject({ url: `/configs/${id}?tenant=demo&revision=1` })).json();
    expect(first.config.module.L_mm).toBe(6000);
  });

  it('client-side tampering cannot change the stored price (server recomputes)', async () => {
    const tampered = { ...REF2, price: 1, revision: 999 } as unknown as Record<string, unknown>;
    const r = await ctx.app.inject({ method: 'POST', url: '/configs', payload: tampered });
    expect(r.json().price.total).toBe(Math.round(evaluate(REF2, DEMO_CATALOG).price.total));
    expect(r.json().revision).toBe(1);
  });

  it('rejects invalid shapes (400) and unknown catalog items (422)', async () => {
    expect((await ctx.app.inject({ method: 'POST', url: '/configs', payload: { ...REF2, module: { type: 'iso_20hc', L_mm: 'x' } } })).statusCode).toBe(400);
    expect((await ctx.app.inject({ method: 'POST', url: '/configs', payload: { foo: 1 } })).statusCode).toBe(400);
    const r = await ctx.app.inject({ method: 'POST', url: '/configs', payload: { ...REF2, cladding: { ...REF2.cladding, exterior: 'NOPE' } } });
    expect(r.statusCode).toBe(422);
  });

  it('wrong or missing tenant → 404 (no cross-tenant access by id)', async () => {
    expect((await ctx.app.inject({ url: `/configs/${id}` })).statusCode).toBe(404);
    expect((await ctx.app.inject({ url: `/configs/${id}?tenant=other` })).statusCode).toBe(404);
    const otherCfg = { ...REF2, tenantId: 'other' };
    expect((await ctx.app.inject({ method: 'PUT', url: `/configs/${id}?tenant=other`, payload: otherCfg })).statusCode).toBe(404);
  });
});

describe('leads', () => {
  it('rejects a configuration with errors (server enforces it too)', async () => {
    const bad = JSON.parse(JSON.stringify(REF2)) as SaunaConfig;
    bad.sauna.heater = { ...bad.sauna.heater, sku: 'HEATER-EL-A' }; // R01: volume out of range
    const { payload, headers } = await multipart(form({ tenant: 'demo', config: bad, contact }));
    const r = await ctx.app.inject({ method: 'POST', url: '/leads', payload, headers });
    expect(r.statusCode).toBe(422);
    expect(r.json().details).toContain('R01');
  });

  it('rejects missing consent / honeypot / foreign files', async () => {
    let m = await multipart(form({ tenant: 'demo', config: REF2, contact: { ...contact, consent: false } }));
    expect((await ctx.app.inject({ method: 'POST', url: '/leads', ...m })).statusCode).toBe(400);
    m = await multipart(form({ tenant: 'demo', config: REF2, contact, website: 'http://spam' }));
    expect((await ctx.app.inject({ method: 'POST', url: '/leads', ...m })).statusCode).toBe(400);
    const fd = form({ tenant: 'demo', config: REF2, contact });
    fd.set('photo', new Blob([Buffer.from('MZ')], { type: 'application/x-msdownload' }), 'x.exe');
    m = await multipart(fd);
    expect((await ctx.app.inject({ method: 'POST', url: '/leads', ...m })).statusCode).toBe(415);
  });

  it('lead → offer.pdf + tech.pdf + bom.xlsx → e-mails (manufacturer + customer) → signed webhook, within 1 minute', async () => {
    const before = ctx.mailer.outbox.length;
    const fd = form({ tenant: 'demo', config: defaultConfig(DEMO_CATALOG), contact, locale: 'de' });
    fd.set('photo', new Blob([PNG], { type: 'image/png' }), 'misto.png');
    fd.set('snapshot_iso_front', new Blob([PNG], { type: 'image/png' }), 'iso_front.png');
    const t0 = Date.now();
    const r = await ctx.app.inject({ method: 'POST', url: '/leads', ...(await multipart(fd)) });
    expect(r.statusCode).toBe(201);
    const { leadId, configId } = r.json();
    expect(leadId).toMatch(/^l/);
    // Worker: process due jobs (lead.process, then lead.webhook).
    await drain({ db: ctx.db, mailer: ctx.mailer, pdf: ctx.pdf, cfg: ctx.cfg });
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(60_000);
    const mails = ctx.mailer.outbox.slice(before);
    const toMaker = mails.find((m) => m.to === 'poptavky@demo-sauny.example')!;
    const toCustomer = mails.find((m) => m.to === contact.email)!;
    expect(toMaker.attachments!.map((a) => a.filename).sort()).toEqual([`kusovnik-${configId}.xlsx`, 'misto.png', `nabidka-${configId}.pdf`, `technicky-list-${configId}.pdf`].sort());
    for (const a of toMaker.attachments!.filter((x) => x.filename.endsWith('.pdf'))) expect(a.content.subarray(0, 4).toString()).toBe('%PDF');
    expect(toMaker.attachments!.find((a) => a.filename.endsWith('.xlsx'))!.content.subarray(0, 2).toString()).toBe('PK');
    expect(toCustomer.subject).toContain('Ihre Sauna-Anfrage');
    expect(toCustomer.attachments).toHaveLength(1);
    const hook = ctx.hooks.at(-1)!;
    expect(JSON.parse(hook.body).lead.id).toBe(leadId);
    expect(verifyWebhook('s3cret', String(hook.headers['x-sauna-signature']), hook.body)).toBe(true);
    expect(verifyWebhook('wrong', String(hook.headers['x-sauna-signature']), hook.body)).toBe(false);
    console.log(`lead delivered (PDF×2, XLSX, 2 e-mails, webhook) in ${elapsed} ms`);
  });

  it('failed webhook is retried with backoff', async () => {
    const { enqueue } = await import('../src/repo.js');
    const failing = async () => new Response('no', { status: 500 });
    const leadsRes = await ctx.db.query.leads.findFirst();
    await enqueue(ctx.db, ctx.demo.id, 'lead.webhook', { leadId: leadsRes!.id });
    await drain({ db: ctx.db, mailer: ctx.mailer, pdf: ctx.pdf, cfg: ctx.cfg, fetch: failing as typeof fetch });
    const job = (await ctx.db.query.jobs.findMany()).find((j) => j.type === 'lead.webhook' && j.status === 'pending')!;
    expect(job.attempts).toBe(1);
    expect(job.lastError).toContain('webhook HTTP 500');
    expect(job.runAt.getTime()).toBeGreaterThan(Date.now());
  });
});

function form(payload: Record<string, unknown>): FormData {
  const fd = new FormData();
  fd.set('payload', JSON.stringify(payload));
  return fd;
}

// 1×1 transparent PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
