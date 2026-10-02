/**
 * M3 end-to-end: manufacturer page (origin A) embeds the configurator from the "CDN" (origin B).
 * Prerequisite: `pnpm --filter @sauna/embed build && pnpm --filter @sauna/configurator build`.
 * Writes screenshots and results to docs/m3/.
 */
import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';
import { readFile, mkdir, writeFile, stat } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../../..');
const out = join(root, 'docs/m3');
const chromePath = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.webp': 'image/webp' };
await mkdir(out, { recursive: true });

function serve(resolve) {
  const s = createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = await resolve(path);
    try {
      let body = await readFile(file.path);
      if (file.transform) body = Buffer.from(file.transform(body.toString()));
      const gz = /\.(js|css|html)$/.test(file.path);
      res.writeHead(200, { 'content-type': TYPES[extname(file.path)] ?? 'application/octet-stream', ...(gz ? { 'content-encoding': 'gzip' } : {}) });
      res.end(gz ? gzipSync(body) : body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((r) => s.listen(0, '127.0.0.1', () => r(s)));
}

const cdn = await serve(async (p) => {
  if (p === '/embed.js') return { path: join(root, 'apps/embed/dist/embed.js') };
  if (p.startsWith('/configurator/')) {
    const rest = p.slice('/configurator/'.length) || 'index.html';
    return { path: join(root, 'apps/configurator/dist', rest) };
  }
  return { path: '/nonexistent' };
});
const cdnBase = `http://127.0.0.1:${cdn.address().port}`;
const host = await serve(async () => ({ path: join(root, 'apps/embed/demo/host.html'), transform: (s) => s.replace('__CDN__', cdnBase) }));
const hostUrl = `http://localhost:${host.address().port}/sauny`;

const browser = await chromium.launch({ executablePath: chromePath, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let failed = 0;
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` – ${detail}` : ''}`);
};
const events = async (page) => page.evaluate(() => window.dataLayer.map((e) => e.event));

const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(`${m.text()} ${m.location()?.url ?? ''}`));
await page.goto(hostUrl);
await page.waitForTimeout(500);
check('iframe is not loaded before the container is near the viewport', (await page.locator('iframe').count()) === 0);
await page.locator('[data-sauna-configurator]').scrollIntoViewIfNeeded();
await page.waitForSelector('iframe');
const frameEl = await page.$('iframe');
const frame = await frameEl.contentFrame();
await frame.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
await frame.waitForFunction(() => !!window.__viewer, null, { timeout: 30000 });
check('iframe origin = CDN, host origin differs', frame.url().startsWith(cdnBase) && !hostUrl.startsWith(cdnBase), frame.url().split('?')[0]);

// Step 1: length 6.0 m → price changes → price_change event.
const price0 = await frame.textContent('[data-testid=price]');
await frame.$eval('input[name=length]', (el) => {
  el.value = '6000';
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
await page.waitForFunction(() => window.dataLayer.some((e) => e.event === 'sauna_price_change'), null, { timeout: 5000 });
const price1 = await frame.textContent('[data-testid=price]');
check('live price updates and host receives price_change', price0 !== price1, `${price0} → ${price1}`);

// Auto height.
await page.waitForTimeout(300);
const heights = await page.evaluate(() => document.querySelector('iframe').getBoundingClientRect().height);
const inner = await frame.evaluate(() => document.documentElement.getBoundingClientRect().height);
check('iframe height follows content', Math.abs(heights - inner) <= 3, `iframe ${heights} px, content ${inner} px`);
await page.screenshot({ path: join(out, 'host-desktop.png'), fullPage: false });

// Step 2: two zones.
await frame.click('text=Pokračovat');
await frame.click('text=Sauna + převlékárna');
await page.waitForFunction(() => window.dataLayer.filter((e) => e.event === 'sauna_step_change').length >= 1);
check('step_change reaches the host', (await events(page)).includes('sauna_step_change'));

// Step 3: place a window via the 2D slot picker (back wall), then via a 3D click (front wall).
await frame.click('.stepper li:nth-child(3) button');
await frame.click('text=Okno 900×600');
await frame.click('text=Zadní');
await frame.click('.wall .slot[data-slot="1"]');
const spans = await frame.$$eval('.wall .span', (s) => s.map((x) => `${x.dataset.opening}:${x.textContent}@${x.style.left}`));
check('2D slot click places the selected product', spans.length === 1, spans.join(', ') + (spans.length === 1 ? '' : ' ' + JSON.stringify(await frame.evaluate(() => window.__config.openings))));

const target = await frame.evaluate(() => {
  const v = window.__viewer;
  let mesh;
  v.scene.traverse((o) => {
    if (o.name === 'wall-S/clad/slot-8') mesh = o;
  });
  const box = new mesh.geometry.boundingBox.constructor().setFromObject(mesh);
  const c = box.getCenter(box.min.clone()).project(v.camera);
  const r = v.renderer.domElement.getBoundingClientRect();
  return { x: ((c.x + 1) / 2) * r.width + r.left, y: ((1 - c.y) / 2) * r.height + r.top };
});
const fb = await frameEl.boundingBox();
await page.mouse.click(fb.x + target.x, fb.y + target.y);
await frame.waitForTimeout(400);
const front = await frame.$$eval('.wall .span', (s) => s.map((x) => x.textContent));
const frontWall = await frame.$eval('input[name=wall]:checked', (i) => i.parentElement.textContent);
check('3D slot click switches to the clicked wall and places the product', frontWall.includes('Přední') && front.length >= 2, `${frontWall}: ${front.join(', ')}`);
await page.screenshot({ path: join(out, 'host-openings.png') });

// Step 5: unsuitable heaters are disabled; make an error (heater into the door passage) and fix it in one click.
await frame.click('.stepper li:nth-child(5) button');
const disabled = await frame.$$eval('input[name=heater]', (xs) => xs.filter((x) => x.disabled).length);
check('heaters outside the volume range cannot be chosen', disabled >= 1, `${disabled} disabled`);
await frame.selectOption('select[name=heaterWall]', 'S');
await frame.$eval('input[name=heaterPos]', (el) => {
  el.value = el.min;
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
await frame.waitForTimeout(200);
const errs = await frame.$$eval('.warnings li.w-err', (xs) => xs.map((x) => x.dataset.rule));
check('invalid heater position produces an error', errs.length > 0, errs.join(', '));

// Step 8: submit must be blocked while errors exist.
await frame.click('.stepper li:nth-child(8) button');
const blocked = await frame.$eval('button[type=submit]', (b) => b.disabled);
check('submit is disabled while the configuration has errors', blocked === true);
while (await frame.$('.warnings li.w-err button')) {
  await frame.click('.warnings li.w-err button');
  await frame.waitForTimeout(150);
}
const left = await frame.$$eval('.warnings li.w-err', (xs) => xs.map((x) => `${x.dataset.rule}: ${x.textContent}`));
check('one-click fixes clear the errors', left.length === 0, left.join(' | ') || 'none left');

// Contact form + lead.
await frame.fill('input[name=name]', 'Jan Novák');
await frame.fill('input[name=email]', 'jan.novak@example.com');
await frame.fill('input[name=phone]', '+420 777 123 456');
await frame.fill('input[name=postalCode]', '602 00');
await frame.fill('textarea[name=note]', 'Pozemek ve svahu.');
await frame.setInputFiles('input[name=photo]', { name: 'misto.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(2048, 1) });
await frame.check('input[name=consent]');
const enabled = await frame.$eval('button[type=submit]', (b) => !b.disabled);
check('submit is enabled with a valid form and no errors', enabled);
await frame.click('button[type=submit]');
await page.waitForFunction(() => window.dataLayer.some((e) => e.event === 'sauna_lead_submitted'), null, { timeout: 5000 });
const lead = await page.evaluate(() => window.dataLayer.find((e) => e.event === 'sauna_lead_submitted'));
check('lead_submitted reaches the host (GA4/GTM dataLayer)', !!lead?.leadId, JSON.stringify(lead));
await page.screenshot({ path: join(out, 'host-lead-sent.png') });

// Share link points to the host page with ?c=<id> and restores the configuration.
await frame.click('text=Uložit a sdílet');
await frame.waitForSelector('input[name=shareLink]');
const link = await frame.$eval('input[name=shareLink]', (i) => i.value);
check('share link = host page + ?c=<id>', link.startsWith(hostUrl) && /[?&]c=c[\w]+/.test(link), link);
const page2 = await ctx.newPage();
await page2.goto(link);
await page2.locator('[data-sauna-configurator]').scrollIntoViewIfNeeded();
const f2 = await (await page2.waitForSelector('iframe')).contentFrame();
await f2.waitForFunction(() => window.__ready === true);
await f2.click('.stepper li:nth-child(1) button');
const len = await f2.$eval('input[name=length]', (i) => i.value);
const zones2 = await f2.$$eval('.stepper', () => 0);
check('shared link restores the saved configuration', len === '6000', `length ${len}`);
void zones2;

// No cookies anywhere.
const cookies = await ctx.cookies();
check('no cookies (first or third party)', cookies.length === 0, `${cookies.length} cookies`);
check('no console errors on the host page', errors.length === 0, errors.slice(0, 3).join(' | '));
await ctx.close();

// Click-to-load mode + mobile screenshot.
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const mp = await m.newPage();
await mp.goto(hostUrl);
await mp.locator('[data-sauna-configurator]').scrollIntoViewIfNeeded();
const mf = await (await mp.waitForSelector('iframe')).contentFrame();
await mf.waitForFunction(() => window.__ready === true && !!window.__viewer, null, { timeout: 30000 });
await mp.waitForTimeout(800);
await (await mp.$('iframe')).screenshot({ path: join(out, 'mobile-configurator.png') });
await m.close();

// Mobile time to interactive of the iframe content (4G 9 Mbit/s, RTT 170 ms, CPU 4× slower, cold cache).
const tti = {};
{
  const mc = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const pg = await mc.newPage();
  const cdp = await mc.newCDPSession(pg);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 170, downloadThroughput: 9e6 / 8, uploadThroughput: 1.5e6 / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const t0 = Date.now();
  await pg.goto(`${cdnBase}/configurator/?tenant=demo&lang=cs`);
  await pg.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
  tti.wizard_ms = Date.now() - t0;
  await pg.waitForFunction(() => !!window.__viewer, null, { timeout: 60000 });
  await pg.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  tti.viewer_ms = Date.now() - t0;
  await mc.close();
}
check('mobile 4G: wizard + price interactive < 3 s', tti.wizard_ms < 3000, `wizard ${tti.wizard_ms} ms, 3D ${tti.viewer_ms} ms`);

// Bundle sizes.
const size = async (p) => (await stat(p)).size;
const gz = async (p) => gzipSync(await readFile(p)).length;
const embedPath = join(root, 'apps/embed/dist/embed.js');
const embedMin = await size(embedPath);
const embedGz = await gz(embedPath);
check('embed.js < 5 kB', embedMin < 5120, `${embedMin} B min, ${embedGz} B gzip`);
await writeFile(join(out, 'e2e-results.json'), JSON.stringify({ results, embed: { min: embedMin, gzip: embedGz }, mobileTti: tti }, null, 2) + '\n');

await browser.close();
cdn.close();
host.close();
if (failed) {
  console.error(`${failed} check(s) failed`);
  process.exit(1);
}
