/**
 * M2 browser test: builds nothing, serves ../dist-demo (run `pnpm build:demo` first),
 * drives Chromium (SwiftShader WebGL) and writes screenshots + metrics to docs/m2/.
 *   - each reference config renders without console errors
 *   - section mode hides roof + front wall
 *   - real mouse click on a slot emits `slotclick`
 *   - exportSnapshots() returns 4 PNGs 1600 × 1000
 *   - mobile (390 × 844, DPR 3, 4× CPU throttle, 4G network): time to interactive
 */
import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';
import { readFile, mkdir, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, '../dist-demo');
const out = join(here, '../../../docs/m2');
const chromePath = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.css': 'text/css', '.png': 'image/png' };

if (!existsSync(join(dist, 'index.html'))) throw new Error('run `pnpm build:demo` first');
await mkdir(join(out, 'snapshots'), { recursive: true });

const server = createServer(async (req, res) => {
  const p = join(dist, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/$/, '/index.html'));
  try {
    const body = await readFile(p);
    const gz = /\.(js|html|css|wasm)$/.test(p) && /gzip/.test(req.headers['accept-encoding'] ?? '');
    res.writeHead(200, { 'content-type': TYPES[extname(p)] ?? 'application/octet-stream', ...(gz ? { 'content-encoding': 'gzip' } : {}) });
    res.end(gz ? gzipSync(body) : body); // like a CDN
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({ executablePath: chromePath, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const results = { refs: {}, checks: [] };
let failed = 0;
const check = (name, ok, detail = '') => {
  results.checks.push({ name, ok, detail });
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` – ${detail}` : ''}`);
};

async function open(page, url) {
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  const t0 = Date.now();
  await page.goto(url);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
  return { errors, readyMs: Date.now() - t0 };
}

// ---------------------------------------------------------------- desktop
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  for (const i of [1, 2, 3]) {
    const { errors, readyMs } = await open(page, `${base}?ref=${i}`);
    await page.waitForTimeout(300);
    const stats = await page.evaluate(() => window.__viewer.stats());
    await page.screenshot({ path: join(out, `ref-${i}.png`) });
    await page.evaluate(() => {
      window.__viewer.setSectionMode(true);
      window.__viewer.render();
    });
    await page.screenshot({ path: join(out, `ref-${i}-section.png`) });
    results.refs[`ref-${i}`] = { readyMs, ...stats };
    check(`ref-${i} renders without console errors`, errors.length === 0 && stats.triangles > 0, errors.join(' | ') || `${stats.drawCalls} draw calls, ${stats.triangles} triangles`);
  }

  // Section mode hides the roof and the front wall.
  const hidden = await page.evaluate(() => {
    const v = window.__viewer;
    v.setSectionMode(true);
    const vis = (name) => {
      let n = 0;
      let h = 0;
      v.scene.traverse((o) => {
        if (o.isMesh && o.parent?.name === name) {
          n++;
          if (!o.visible) h++;
        }
      });
      return [h, n];
    };
    return { roof: vis('roof'), back: vis('wall-N') };
  });
  check('section mode hides roof, keeps back wall', hidden.roof[0] === hidden.roof[1] && hidden.roof[1] > 0 && hidden.back[0] === 0, JSON.stringify(hidden));

  // Real mouse click on a slot: project the centre of S-wall slot 1 cladding to screen.
  await page.evaluate(() => window.__viewer.setSectionMode(false));
  await page.goto(`${base}?ref=1`);
  await page.waitForFunction(() => window.__ready === true);
  const target = await page.evaluate(() => {
    const v = window.__viewer;
    let mesh;
    v.scene.traverse((o) => {
      if (o.name === 'wall-S/clad/slot-1') mesh = o;
    });
    const box = new mesh.geometry.boundingBox.constructor().setFromObject(mesh);
    const c = box.getCenter(box.min.clone());
    c.project(v.camera);
    const r = v.renderer.domElement.getBoundingClientRect();
    window.__clicks = [];
    v.on('slotclick', (s) => window.__clicks.push(s));
    return { x: ((c.x + 1) / 2) * r.width + r.left, y: ((1 - c.y) / 2) * r.height + r.top };
  });
  await page.mouse.move(target.x, target.y);
  await page.mouse.down();
  await page.mouse.up();
  const clicks = await page.evaluate(() => window.__clicks);
  check('mouse click on a slot emits slotclick', clicks.length === 1 && clicks[0].wall === 'S' && clicks[0].index === 1, JSON.stringify(clicks));
  await page.screenshot({ path: join(out, 'ref-1-slot-selected.png') });

  // Partial rebuild: move the heater.
  const sync = await page.evaluate(() => {
    let res;
    const off = window.__viewer.on('sync', (r) => (res = r));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm' }));
    off();
    return res;
  });
  check('moving the heater rebuilds only heater, chimney, ventilation', JSON.stringify(sync.rebuilt.sort()) === '["chimney","heater","ventilation"]', `kept ${sync.kept.length}`);

  // Snapshots.
  const snaps = await page.evaluate(async () => {
    const s = await window.__viewer.exportSnapshots();
    const dims = await Promise.all(
      s.map(
        (x) =>
          new Promise((res) => {
            const img = new Image();
            img.onload = () => res([img.naturalWidth, img.naturalHeight]);
            img.src = x.dataUrl;
          }),
      ),
    );
    return s.map((x, i) => ({ view: x.view, dims: dims[i], dataUrl: x.dataUrl }));
  });
  for (const s of snaps) await writeFile(join(out, 'snapshots', `ref-1-${s.view}.png`), Buffer.from(s.dataUrl.split(',')[1], 'base64'));
  check('exportSnapshots → 4 PNG 1600×1000', snaps.length === 4 && snaps.every((s) => s.dims[0] === 1600 && s.dims[1] === 1000), snaps.map((s) => `${s.view} ${s.dims.join('×')}`).join(', '));
  await page.close();
}

// ----------------------------------------------------------------- mobile
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  // "4G": 9 Mbit/s down, 1.5 Mbit/s up, 170 ms RTT (Lighthouse mobile profile ~ slow 4G is 1.6 Mbit/s; we report both)
  const profiles = {
    '4G (9 Mbit/s, 170 ms)': { latency: 170, downloadThroughput: (9e6 / 8), uploadThroughput: (1.5e6 / 8) },
    'slow 4G (1.6 Mbit/s, 150 ms)': { latency: 150, downloadThroughput: (1.6e6 / 8), uploadThroughput: (750e3 / 8) },
  };
  results.mobile = {};
  for (const [name, p] of Object.entries(profiles)) {
    await cdp.send('Network.emulateNetworkConditions', { offline: false, ...p });
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const { errors, readyMs } = await open(page, `${base}?ref=2`);
    const stats = await page.evaluate(() => window.__viewer.stats());
    const marks = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const m = Object.fromEntries(performance.getEntriesByType('mark').map((x) => [x.name, Math.round(x.startTime)]));
      return { responseEnd: Math.round(nav.responseEnd), domContentLoaded: Math.round(nav.domContentLoadedEventEnd), ...m };
    });
    results.mobile[name] = { readyMs, marks, ...stats };
    console.log(name, JSON.stringify(marks));
    check(`mobile ${name}: interactive in ${readyMs} ms`, errors.length === 0, errors.join(' | '));
  }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await page.screenshot({ path: join(out, 'mobile-ref-2.png') });
  await ctx.close();
}

// Transfer size of the initial load.
const files = ['index.html', ...((await readFile(join(dist, 'index.html'), 'utf8')).match(/assets\/[^"]+\.js/g) ?? [])];
let bytes = 0;
for (const f of files) bytes += (await stat(join(dist, f))).size;
results.initialLoadBytes = bytes;
console.log(`initial load (uncompressed): ${(bytes / 1024).toFixed(0)} kB in ${files.length} files`);

await writeFile(join(out, 'e2e-results.json'), JSON.stringify(results, null, 2) + '\n');
await browser.close();
server.close();
if (failed) {
  console.error(`${failed} check(s) failed`);
  process.exit(1);
}
