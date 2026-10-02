/**
 * M6 end-to-end: manufacturer page (embed) → configurator iframe (API) → lead → worker
 * (PDF, XLSX, e-mails) → admin. Also checks client/server price equality and tenant isolation
 * in the admin. Prerequisite: none (builds what it needs). Output: docs/m6/full-flow*.
 */
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { chromium, type Frame, type Page } from 'playwright-core';
import { DEMO_CATALOG } from '@sauna/core/fixtures';
import { buildApp } from '@sauna/api/src/app.js';
import { openDb } from '@sauna/api/src/db/index.js';
import { readEnv } from '@sauna/api/src/env.js';
import { addUser, createTenant } from '@sauna/api/src/repo.js';
import { seedDemo } from '@sauna/api/src/seed.js';
import { startWorker } from '@sauna/api/src/services/jobs.js';
import { MemoryMailer } from '@sauna/api/src/services/mailer.js';
import { PdfRenderer } from '@sauna/api/src/services/pdf.js';
// @ts-expect-error – plain ESM helper
import { root, startSites } from './lib/servers.mjs';

const out = join(root, 'docs/m6');
mkdirSync(out, { recursive: true });
const API = 'http://localhost:38990';
const ADMIN = 'http://localhost:38992/';

// API + two tenants.
const cfg = { ...readEnv({ NODE_ENV: 'test' }), databaseUrl: process.env['TEST_DATABASE_URL'] ? process.env['TEST_DATABASE_URL'] : 'pglite://memory', publicUrl: API, adminUrl: ADMIN, workerIntervalMs: 200 };
const { db, close } = await openDb(cfg.databaseUrl);
const demo = await seedDemo(db);
const other = await createTenant(db, { slug: 'other', name: 'Jiné Sauny a.s.', catalog: { ...DEMO_CATALOG, tenantId: 'other', version: 'other-1' }, settings: { ...demo.settings, notifyEmail: 'leads@other.example' } });
await addUser(db, other.id, 'admin@other.example', 'admin');
const mailer = new MemoryMailer();
const pdf = new PdfRenderer(cfg.chromiumPath);
const app = await buildApp({ db, cfg, mailer, pdf });
const stopWorker = startWorker({ db, mailer, pdf, cfg });
await app.listen({ port: 38990, host: '127.0.0.1' });

// Builds against the API.
const build = (pkg: string, dir: string) => execFileSync('npx', ['vite', 'build', '--outDir', dir, '--emptyOutDir'], { cwd: join(root, pkg), env: { ...process.env, VITE_API_BASE: API }, stdio: 'ignore' });
const cfgDist = join(root, 'apps/configurator/dist-e2e');
const adminDist = join(root, 'apps/admin/dist-e2e');
build('apps/configurator', cfgDist);
build('apps/admin', adminDist);
execFileSync('npx', ['vite', 'build'], { cwd: join(root, 'apps/embed'), stdio: 'ignore' });
const sites = await startSites({ configuratorDist: cfgDist });
const adminWeb = createServer((req, res) => {
  const p = new URL(req.url ?? '/', 'http://x').pathname;
  try {
    const f = join(adminDist, p === '/' ? 'index.html' : p);
    res.writeHead(200, { 'content-type': ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' } as Record<string, string>)[extname(f)] ?? 'application/octet-stream' }).end(readFileSync(f));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise<void>((r) => adminWeb.listen(38992, '127.0.0.1', r));

let failed = 0;
const results: Array<{ name: string; ok: boolean; detail: string }> = [];
const check = (name: string, ok: boolean, detail = '') => {
  results.push({ name, ok, detail });
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` – ${detail}` : ''}`);
};

async function adminLogin(page: Page, tenant: string, email: string) {
  await page.goto(ADMIN);
  await page.fill('input[name=tenant]', tenant);
  await page.fill('input[name=email]', email);
  const n = mailer.outbox.length;
  await page.click('button[type=submit]');
  await page.waitForSelector('text=poslali jsme');
  await page.goto(/https?:\/\/\S+/.exec(mailer.outbox[n]!.text)![0]);
  await page.waitForSelector('.shell header');
}

const browser = await chromium.launch({ executablePath: cfg.chromiumPath, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const t0 = Date.now();
try {
  // 1) Customer on the manufacturer's page.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`${sites.hostBase}/sauny`);
  await page.locator('[data-sauna-configurator]').scrollIntoViewIfNeeded();
  const frame = (await (await page.waitForSelector('iframe')).contentFrame()) as Frame;
  await frame.waitForFunction(() => (window as unknown as { __ready?: boolean; __viewer?: unknown }).__ready === true && !!(window as unknown as { __viewer?: unknown }).__viewer, null, { timeout: 30000 });
  check('configurator in the iframe loads the tenant from the API', (await frame.textContent('header'))!.includes('Demo Sauny'));

  await frame.$eval('input[name=length]', (el) => {
    (el as HTMLInputElement).value = '4800';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await frame.click('.stepper li:nth-child(3) button');
  await frame.click('text=Okno 900×600');
  await frame.click('text=Zadní');
  await frame.click('.wall .slot[data-slot="2"]');
  await frame.click('.stepper li:nth-child(6) button');
  await frame.click('text=čelní');
  await frame.click('.stepper li:nth-child(8) button');
  // The bigger sauna needs a bigger heater: the customer uses the one-click fix (R01).
  const r01 = await frame.$('.warnings li.w-err[data-rule="R01"] button');
  // The warning list re-renders after each evaluation, so retry until the fix has been applied.
  for (let i = 0; r01 && i < 5 && (await frame.$('.warnings li.w-err[data-rule="R01"]')); i++) {
    await frame.click('.warnings li.w-err[data-rule="R01"] button').catch(() => undefined);
    await frame.waitForTimeout(500);
  }
  check('R01 offered a one-click heater fix for the larger sauna', !!r01);
  const errorsInCfg = await frame.$$eval('.warnings li.w-err', (x) => x.map((e) => `${(e as HTMLElement).dataset['rule']}: ${e.textContent}`));
  check('configuration (4,8 m, window, front terrace) has no errors', errorsInCfg.length === 0, errorsInCfg.join(' | ') || '0 errors');
  await frame.fill('input[name=name]', 'Tomáš Černý');
  await frame.fill('input[name=email]', 'tomas@example.com');
  await frame.fill('input[name=postalCode]', '738 01');
  await frame.check('input[name=consent]');
  const tLead = Date.now();
  await frame.click('button[type=submit]');
  await page.waitForFunction(() => (window as unknown as { dataLayer: Array<{ event: string }> }).dataLayer.some((e) => e.event === 'sauna_lead_submitted'), null, { timeout: 30000 });
  const ev = await page.evaluate(() => (window as unknown as { dataLayer: Array<Record<string, unknown>> }).dataLayer.find((e) => e.event === 'sauna_lead_submitted')!);
  check('host page receives lead_submitted', typeof ev['leadId'] === 'string', String(ev['leadId']));
  await page.screenshot({ path: join(out, 'full-flow-host.png') });

  // 2) Worker → e-mails within 1 minute.
  let maker;
  while (Date.now() - tLead < 60_000) {
    maker = mailer.outbox.find((m) => m.to === demo.settings.notifyEmail && m.subject.includes(String(ev['leadId'])));
    if (maker && mailer.outbox.some((m) => m.to === 'tomas@example.com')) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  const delivery = Date.now() - tLead;
  check('lead with offer.pdf, tech.pdf and bom.xlsx delivered within 1 minute', !!maker && maker.attachments!.length === 3 && delivery < 60_000, `${delivery} ms`);

  // 3) Manufacturer in the admin.
  const actx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const ap = await actx.newPage();
  await adminLogin(ap, 'demo', 'admin@demo-sauny.example');
  await ap.waitForSelector(`tr[data-lead="${ev['leadId']}"]`);
  const lead = await ap.evaluate(async ([api, id]) => (await (await fetch(`${api}/admin/leads/${id}`, { credentials: 'include' })).json()) as { priceTotal: number; configId: string }, [API, String(ev['leadId'])]);
  check('server price = price computed in the browser (same core)', lead.priceTotal === ev['value'], `server ${lead.priceTotal} / client ${String(ev['value'])}`);
  await ap.click('text=Tomáš Černý');
  await ap.waitForSelector('[data-export="tech.pdf"]');
  const dl = await Promise.all(['offer.pdf', 'tech.pdf', 'bom.xlsx'].map(async (n) => (await ap.request.get((await ap.getAttribute(`[data-export="${n}"]`, 'href'))!)).ok()));
  check('admin downloads offer.pdf, tech.pdf, bom.xlsx', dl.every(Boolean));
  await ap.screenshot({ path: join(out, 'full-flow-admin.png'), fullPage: true });

  // 4) Another tenant's admin sees nothing of it.
  const octx = await browser.newContext();
  const op = await octx.newPage();
  await adminLogin(op, 'other', 'admin@other.example');
  await op.waitForSelector('text=Zatím žádné poptávky');
  await op.goto(`${ADMIN}#/leads/${ev['leadId']}`);
  await op.waitForSelector('text=Poptávka nenalezena');
  const exp = await op.request.get(`${API}/configs/${lead.configId}/exports/offer.pdf`);
  check('another tenant: no leads, detail and export not found', exp.status() === 404, `export ${exp.status()}`);
  check('no page errors', errors.length === 0, errors.join(' | '));
  writeFileSync(join(out, 'full-flow-results.json'), JSON.stringify({ results, leadDelivery_ms: delivery, total_ms: Date.now() - t0 }, null, 2) + '\n');
} finally {
  await browser.close();
  stopWorker();
  await app.close();
  await pdf.close();
  await close();
  await sites.close();
  adminWeb.close();
}
if (failed) {
  console.error(`${failed} check(s) failed`);
  process.exit(1);
}
