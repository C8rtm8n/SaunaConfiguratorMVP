/**
 * M4 browser e2e: configurator (built against this API) → save/share → lead with 3D snapshots
 * → worker → PDFs/XLSX → e-mails. Run: pnpm --filter @sauna/api e2e
 */
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { and, eq } from 'drizzle-orm';
import { chromium } from 'playwright-core';
import { buildApp } from '../src/app.js';
import { openDb } from '../src/db/index.js';
import { files } from '../src/db/schema.js';
import { readEnv } from '../src/env.js';
import { seedDemo } from '../src/seed.js';
import { startWorker } from '../src/services/jobs.js';
import { MemoryMailer } from '../src/services/mailer.js';
import { PdfRenderer } from '../src/services/pdf.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../../..');
const out = join(root, 'docs/m4');
mkdirSync(out, { recursive: true });
const API_PORT = 38990;
const apiBase = `http://127.0.0.1:${API_PORT}`;

// 1) API with in-memory PostgreSQL, memory mailer and the job worker.
const cfg = { ...readEnv({ NODE_ENV: 'test' }), databaseUrl: 'pglite://memory', publicUrl: apiBase, configuratorUrl: 'http://localhost:38991/', workerIntervalMs: 200 };
const { db, close } = await openDb(cfg.databaseUrl);
const tenant = await seedDemo(db);
const mailer = new MemoryMailer();
const pdf = new PdfRenderer(cfg.chromiumPath);
const app = await buildApp({ db, cfg, mailer, pdf });
const stopWorker = startWorker({ db, mailer, pdf, cfg });
await app.listen({ port: API_PORT, host: '127.0.0.1' });

// 2) Configurator built against the API, served from another origin.
const dist = join(root, 'apps/configurator/dist-e2e');
execFileSync('npx', ['vite', 'build', '--outDir', dist, '--emptyOutDir'], { cwd: join(root, 'apps/configurator'), env: { ...process.env, VITE_API_BASE: apiBase }, stdio: 'ignore' });
const TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.wasm': 'application/wasm' };
const web = createServer((req, res) => {
  const p = new URL(req.url ?? '/', 'http://x').pathname;
  try {
    const f = join(dist, p === '/' ? 'index.html' : p);
    res.writeHead(200, { 'content-type': TYPES[extname(f)] ?? 'application/octet-stream' }).end(readFileSync(f));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise<void>((r) => web.listen(38991, '127.0.0.1', r));
const appUrl = 'http://localhost:38991/';

let failed = 0;
const results: Array<{ name: string; ok: boolean; detail: string }> = [];
const check = (name: string, ok: boolean, detail = '') => {
  results.push({ name, ok, detail });
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` – ${detail}` : ''}`);
};

const browser = await chromium.launch({ executablePath: cfg.chromiumPath, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${appUrl}?tenant=demo&lang=cs`);
  await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true && !!(window as unknown as { __viewer?: unknown }).__viewer, null, { timeout: 30000 });
  check('configurator loads the tenant from the API', (await page.textContent('header'))!.includes('Demo Sauny'));

  // Save & share → server revision.
  await page.click('.stepper li:nth-child(8) button');
  await page.click('text=Uložit a sdílet');
  await page.waitForSelector('input[name=shareLink]');
  const link = await page.$eval('input[name=shareLink]', (i) => (i as HTMLInputElement).value);
  const cid = new URL(link).searchParams.get('c')!;
  const stored = await (await fetch(`${apiBase}/configs/${cid}?tenant=demo`)).json();
  check('save stores a server revision', stored.revision === 1 && stored.id === cid, `${cid} rev ${stored.revision}`);

  // Lead with snapshots.
  await page.fill('input[name=name]', 'Petra Svobodová');
  await page.fill('input[name=email]', 'petra@example.com');
  await page.fill('input[name=postalCode]', '370 01');
  await page.check('input[name=consent]');
  const t0 = Date.now();
  await page.click('button[type=submit]');
  await page.waitForSelector('p.ok', { timeout: 30000 });
  const leadText = (await page.textContent('p.ok'))!;
  const leadId = /(l[a-z0-9]{6,})/.exec(leadText)?.[1];
  check('lead accepted by the API', !!leadId, leadText);
  const snaps = await db.select({ name: files.name }).from(files).where(and(eq(files.tenantId, tenant.id), eq(files.kind, 'snapshot')));
  check('4 snapshots uploaded with the lead', snaps.length === 4, snaps.map((s) => s.name).join(', '));

  // Wait for the worker to deliver both e-mails.
  let mails: MemoryMailer['outbox'] = [];
  while (Date.now() - t0 < 60_000) {
    mails = mailer.outbox.filter((m) => m.to === 'petra@example.com' || m.to === tenant.settings.notifyEmail);
    if (mails.length >= 2) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  const elapsed = Date.now() - t0;
  const maker = mails.find((m) => m.to === tenant.settings.notifyEmail);
  check('lead with both PDFs and XLSX delivered within 1 minute', !!maker && maker.attachments!.length >= 3 && elapsed < 60_000, `${elapsed} ms, attachments: ${maker?.attachments?.map((a) => a.filename).join(', ')}`);
  const offer = maker?.attachments?.find((a) => a.filename.startsWith('nabidka'));
  if (offer) writeFileSync(join(out, 'e2e-offer.pdf'), offer.content);
  check('offer PDF contains the uploaded renders', !!offer && offer.content.length > 300_000, `${offer?.content.length} B`);

  // Shared link restores the configuration from the server.
  const p2 = await browser.newPage();
  await p2.goto(`${appUrl}?tenant=demo&c=${cid}`);
  await p2.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true);
  const restored = await p2.evaluate(() => (window as unknown as { __config: { id: string } }).__config.id);
  check('shared link loads the configuration from the API', restored === cid, restored);
  check('no page errors', errors.length === 0, errors.join(' | '));
  writeFileSync(join(out, 'e2e-results.json'), JSON.stringify({ results, leadDelivery_ms: elapsed }, null, 2) + '\n');
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
