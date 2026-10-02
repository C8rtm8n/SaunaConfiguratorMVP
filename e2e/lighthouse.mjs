/**
 * M6: Lighthouse on the manufacturer test page. Acceptance: embedding the configurator lowers
 * the score by at most 5 points versus the same page without it.
 * Prerequisite: `pnpm build`. Output: docs/m6/lighthouse*.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import { root, startSites } from './lib/servers.mjs';

const RUNS = Number(process.env.LH_RUNS ?? 3);
const CATS = ['performance', 'accessibility', 'best-practices', 'seo'];
const out = join(root, 'docs/m6');
mkdirSync(out, { recursive: true });
const chromePath = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const sites = await startSites();
const variants = { baseline: `${sites.hostBase}/baseline`, embed: `${sites.hostBase}/sauny`, embedTop: `${sites.hostBase}/sauny-top` };
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const results = {};
const chrome = await chromeLauncher.launch({ chromePath, chromeFlags: ['--headless=new', '--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  for (const [name, url] of Object.entries(variants)) {
    const runs = [];
    for (let i = 0; i < RUNS; i++) {
      const r = await lighthouse(url, { port: chrome.port, output: i === 0 ? 'html' : 'json', onlyCategories: CATS, logLevel: 'error' }, { extends: 'lighthouse:default', settings: { formFactor: 'mobile', throttlingMethod: 'simulate' } });
      const lhr = r.lhr;
      runs.push({
        scores: Object.fromEntries(CATS.map((c) => [c, Math.round((lhr.categories[c]?.score ?? 0) * 100)])),
        metrics: {
          fcp_ms: Math.round(lhr.audits['first-contentful-paint'].numericValue),
          lcp_ms: Math.round(lhr.audits['largest-contentful-paint'].numericValue),
          tbt_ms: Math.round(lhr.audits['total-blocking-time'].numericValue),
          cls: Math.round(lhr.audits['cumulative-layout-shift'].numericValue * 1000) / 1000,
          bytes: lhr.audits['total-byte-weight'].numericValue,
        },
      });
      if (i === 0) writeFileSync(join(out, `lighthouse-${name}.html`), r.report);
    }
    results[name] = {
      scores: Object.fromEntries(CATS.map((c) => [c, median(runs.map((r) => r.scores[c]))])),
      metrics: Object.fromEntries(Object.keys(runs[0].metrics).map((k) => [k, median(runs.map((r) => r.metrics[k]))])),
      runs,
    };
    console.log(name, JSON.stringify(results[name].scores), JSON.stringify(results[name].metrics));
  }
} finally {
  await chrome.kill();
  await sites.close();
}
let failed = 0;
for (const v of ['embed', 'embedTop']) {
  for (const c of CATS) {
    const drop = results.baseline.scores[c] - results[v].scores[c];
    const ok = drop <= 5;
    if (!ok) failed++;
    console.log(`${ok ? '✓' : '✗'} ${v} ${c}: ${results.baseline.scores[c]} → ${results[v].scores[c]} (pokles ${drop})`);
  }
}
writeFileSync(join(out, 'lighthouse-results.json'), JSON.stringify({ runs: RUNS, results }, null, 2) + '\n');
if (failed) process.exit(1);
