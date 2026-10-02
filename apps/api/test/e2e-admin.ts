/**
 * M5 browser e2e: admin app against the API (magic link login, leads, catalog edits → new
 * versions visible to the configurator, rates, theming, XLSX import, read-only sales role).
 * Run: pnpm --filter @sauna/api e2e:admin
 */
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from 'playwright-core';
import { defaultConfig } from '@sauna/core';
import { DEMO_CATALOG } from '@sauna/core/fixtures';
import { buildApp } from '../src/app.js';
import { openDb } from '../src/db/index.js';
import { readEnv } from '../src/env.js';
import { addUser } from '../src/repo.js';
import { seedDemo } from '../src/seed.js';
import { startWorker } from '../src/services/jobs.js';
import { MemoryMailer } from '../src/services/mailer.js';
import { PdfRenderer } from '../src/services/pdf.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../../..');
const out = join(root, 'docs/m5');
mkdirSync(out, { recursive: true });
const API = 'http://localhost:38990';
const ADMIN = 'http://localhost:38992/';

const cfg = { ...readEnv({ NODE_ENV: 'test' }), databaseUrl: 'pglite://memory', publicUrl: API, adminUrl: ADMIN, workerIntervalMs: 200 };
const { db, close } = await openDb(cfg.databaseUrl);
const tenant = await seedDemo(db);
await addUser(db, tenant.id, 'sales@demo-sauny.example', 'sales');
const mailer = new MemoryMailer();
const pdf = new PdfRenderer(cfg.chromiumPath);
const app = await buildApp({ db, cfg, mailer, pdf });
const stopWorker = startWorker({ db, mailer, pdf, cfg });
await app.listen({ port: 38990, host: '127.0.0.1' });

const dist = join(root, 'apps/admin/dist-e2e');
execFileSync('npx', ['vite', 'build', '--outDir', dist, '--emptyOutDir'], { cwd: join(root, 'apps/admin'), env: { ...process.env, VITE_API_BASE: API }, stdio: 'ignore' });
const TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };
const web = createServer((req, res) => {
  const p = new URL(req.url ?? '/', 'http://x').pathname;
  try {
    const f = join(dist, p === '/' ? 'index.html' : p);
    res.writeHead(200, { 'content-type': TYPES[extname(f)] ?? 'application/octet-stream' }).end(readFileSync(f));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise<void>((r) => web.listen(38992, '127.0.0.1', r));

let failed = 0;
const results: Array<{ name: string; ok: boolean; detail: string }> = [];
const check = (name: string, ok: boolean, detail = '') => {
  results.push({ name, ok, detail });
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` – ${detail}` : ''}`);
};
const pub = async () => (await fetch(`${API}/tenants/demo/public`)).json();

async function loginAs(page: Page, email: string) {
  await page.goto(ADMIN);
  await page.fill('input[name=tenant]', 'demo');
  await page.fill('input[name=email]', email);
  const n = mailer.outbox.length;
  await page.click('button[type=submit]');
  await page.waitForSelector('text=poslali jsme');
  const link = /https?:\/\/\S+/.exec(mailer.outbox[n]!.text)![0];
  await page.goto(link); // API sets the session cookie and redirects to the admin
  await page.waitForSelector('.shell header');
}

// A lead to look at.
const fd = new FormData();
fd.set('payload', JSON.stringify({ tenant: 'demo', config: defaultConfig(DEMO_CATALOG), contact: { name: 'Karel Dvořák', email: 'karel@example.com', phone: '+420 600 100 200', postalCode: '664 34', note: 'Chata u Brna', consent: true }, locale: 'cs' }));
const leadRes = await (await fetch(`${API}/leads`, { method: 'POST', body: fd })).json();

const browser = await chromium.launch({ executablePath: cfg.chromiumPath, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await loginAs(page, 'admin@demo-sauny.example');
  check('magic link login lands in the admin', (await page.textContent('.shell header'))!.includes('admin@demo-sauny.example'));

  // Leads.
  await page.waitForSelector(`tr[data-lead="${leadRes.leadId}"]`);
  await new Promise((r) => setTimeout(r, 2500)); // worker generates documents
  await page.reload();
  await page.waitForSelector(`tr[data-lead="${leadRes.leadId}"]`);
  await page.selectOption(`select[name=status-${leadRes.leadId}]`, 'negotiating');
  await page.waitForTimeout(300);
  const st = await page.evaluate(async ([api, id]) => (await (await fetch(`${api}/admin/leads/${id}`, { credentials: 'include' })).json()).status, [API, leadRes.leadId]);
  check('lead status can be changed', st === 'negotiating', st);
  await page.screenshot({ path: join(out, 'leads.png') });
  await page.click(`text=Karel Dvořák`);
  await page.waitForSelector('[data-export="offer.pdf"]');
  const href = await page.getAttribute('[data-export="offer.pdf"]', 'href');
  const pdfRes = await page.request.get(href!);
  check('lead detail: offer.pdf download (session cookie)', pdfRes.ok() && (await pdfRes.body()).subarray(0, 4).toString() === '%PDF', href!);
  await page.screenshot({ path: join(out, 'lead-detail.png'), fullPage: true });

  // Catalog: heater price → dry run → publish.
  await page.goto(`${ADMIN}#/catalog/heaters`);
  await page.waitForSelector('table.grid');
  const sel = 'input[name="0:cost"]';
  await page.fill(sel, '25000');
  await page.dispatchEvent(sel, 'change');
  await page.click('text=Zkontrolovat změny');
  await page.waitForSelector('[data-testid=publish-result]');
  const diffText = (await page.textContent('[data-testid=publish-result]'))!;
  check('dry run shows the changed heater', diffText.includes('HEATER-WOOD-A'), diffText.slice(0, 80));
  await page.screenshot({ path: join(out, 'catalog-heaters.png') });
  await page.click('text=Publikovat novou verzi');
  await page.waitForSelector('text=Publikována verze demo-2');
  const p1 = await pub();
  check('published price reaches the public catalog', Math.round(p1.catalog.heaters[0].cost) === Math.round(25000 * (1 + DEMO_CATALOG.rates.margin.purchased)), `${p1.catalog.version}: ${Math.round(p1.catalog.heaters[0].cost)} Kč (prodejní)`);

  // New window (no code change).
  await page.goto(`${ADMIN}#/catalog/openings`);
  await page.waitForSelector('table.grid');
  await page.click('text=+ Přidat');
  const rows = await page.$$eval('table.grid tbody tr', (r) => r.length);
  const i = rows - 1;
  for (const [path, v] of [['sku', 'WIN-1200x600'], ['name.cs', 'Okno 1200×600'], ['type', ''], ['width_mm', '1200'], ['height_mm', '600'], ['slots.600', '2'], ['slots.1200', '1'], ['glassArea_m2', '0.6']] as const) {
    if (path === 'type') {
      await page.selectOption(`select[name="${i}:type"]`, 'window');
      continue;
    }
    await page.fill(`input[name="${i}:${path}"]`, v);
    await page.dispatchEvent(`input[name="${i}:${path}"]`, 'change');
  }
  await page.uncheck(`input[name="${i}:fullWall"]`).catch(() => undefined);
  await page.click('text=Zkontrolovat změny');
  await page.waitForSelector('[data-testid=publish-result]');
  await page.click('text=Publikovat novou verzi');
  await page.waitForSelector('text=Publikována verze demo-3');
  const p2 = await pub();
  const win = p2.catalog.openings.find((o: { sku: string }) => o.sku === 'WIN-1200x600');
  check('new window added in the admin is in the configurator catalog', !!win && win.slots['600'] === 2, JSON.stringify(win?.slots));
  const cfgWithWin = defaultConfig(p2.catalog);
  cfgWithWin.openings.push({ id: 'w', wall: 'N', slotFrom: 1, slotTo: 2, type: 'window', sku: 'WIN-1200x600' });
  const saved = await (await fetch(`${API}/configs`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cfgWithWin) })).json();
  check('…and the API accepts it in a configuration', saved.config?.openings.some((o: { sku: string }) => o.sku === 'WIN-1200x600'), saved.id);

  // Invalid edit is blocked.
  await page.goto(`${ADMIN}#/catalog/profiles`);
  await page.waitForSelector('table.grid');
  await page.fill('input[name="0:material"]', 'NOPE');
  await page.dispatchEvent('input[name="0:material"]', 'change');
  await page.click('text=Zkontrolovat změny');
  await page.waitForSelector('[data-testid=publish-result] .err');
  const disabled = await page.$eval('text=Publikovat novou verzi', (b) => (b as HTMLButtonElement).disabled);
  check('invalid catalog cannot be published', disabled, (await page.textContent('[data-testid=publish-result] .err'))!);
  await page.screenshot({ path: join(out, 'catalog-invalid.png') });

  // Rates.
  await page.goto(`${ADMIN}#/rates`);
  await page.waitForSelector('input[name="rates.labour_per_h"]');
  await page.fill('input[name="rates.labour_per_h"]', '720');
  await page.dispatchEvent('input[name="rates.labour_per_h"]', 'change');
  await page.selectOption('select[name=priceDisplay]', 'exact');
  await page.click('text=Zkontrolovat změny');
  await page.waitForSelector('[data-testid=publish-result]');
  await page.click('text=Publikovat novou verzi');
  await page.waitForSelector('text=Publikována verze demo-4');
  const p3 = await pub();
  check('rates and price display published', p3.catalog.rates.priceDisplay === 'exact' && Math.round(p3.catalog.rates.labour_per_h) === Math.round(720 * (1 + DEMO_CATALOG.rates.margin.labour)), `${p3.catalog.version}`);
  await page.screenshot({ path: join(out, 'rates.png'), fullPage: true });

  // Theming.
  await page.goto(`${ADMIN}#/settings`);
  await page.waitForSelector('input[name="theme.primary"]');
  await page.$eval('input[name="theme.primary"]', (el) => {
    (el as HTMLInputElement).value = '#1d4e89';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.click('text=Uložit nastavení');
  await page.waitForSelector('text=Uloženo');
  check('theming change reaches the public endpoint', (await pub()).theme.primary === '#1d4e89');
  await page.screenshot({ path: join(out, 'settings.png'), fullPage: true });

  // XLSX export → import (preview → confirm).
  await page.goto(`${ADMIN}#/catalog/heaters`);
  await page.waitForSelector('[data-testid=export-xlsx]');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('[data-testid=export-xlsx]')]);
  const xlsxPath = join(out, 'katalog-export.xlsx');
  await download.saveAs(xlsxPath);
  await page.setInputFiles('input[name=importXlsx]', xlsxPath);
  await page.waitForSelector('[data-testid=import-result]');
  const preview = (await page.textContent('[data-testid=import-result]'))!;
  check('XLSX import preview (round trip has no changes)', preview.includes('Náhled importu') && preview.includes('beze změn'), preview);

  // Sales: read-only.
  const sctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const sp = await sctx.newPage();
  await loginAs(sp, 'sales@demo-sauny.example');
  await sp.goto(`${ADMIN}#/catalog/heaters`);
  await sp.waitForSelector('table.grid');
  const ro = await sp.$eval('input[name="0:cost"]', (i) => (i as HTMLInputElement).disabled);
  const noPublish = (await sp.$('text=Publikovat novou verzi')) === null;
  check('sales role sees the catalog read-only', ro && noPublish);
  const forbidden = await sp.evaluate(async (api) => (await fetch(`${api}/admin/catalog`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ catalog: {} }) })).status, API);
  check('…and the API refuses writes (403)', forbidden === 403, String(forbidden));
  check('no page errors', errors.length === 0, errors.join(' | '));
  writeFileSync(join(out, 'e2e-results.json'), JSON.stringify({ results }, null, 2) + '\n');
} finally {
  await browser.close();
  stopWorker();
  await app.close();
  await pdf.close();
  await close();
  web.close();
}
if (failed) {
  console.error(`${failed} check(s) failed`);
  process.exit(1);
}
