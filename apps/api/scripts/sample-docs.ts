/** Writes sample exports for the reference configs to docs/m4/ (manual review). */
import { mkdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REFERENCE_CONFIGS } from '@sauna/core/fixtures';
import { openDb } from '../src/db/index.js';
import { readEnv } from '../src/env.js';
import { getConfigRevision, saveFile, saveRevision } from '../src/repo.js';
import { seedDemo } from '../src/seed.js';
import { activeCatalog, recompute, summaryOf } from '../src/services/evaluate.js';
import { buildExport, type ExportName } from '../src/services/documentsFor.js';
import { PdfRenderer } from '../src/services/pdf.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const out = join(root, 'docs/m4');
mkdirSync(out, { recursive: true });
const cfg = { ...readEnv({ NODE_ENV: 'test' }), configuratorUrl: 'https://konfigurator.demo-sauny.example/' };
const { db, close } = await openDb('pglite://memory');
const tenant = await seedDemo(db);
const catalog = await activeCatalog(db, tenant);
const pdf = new PdfRenderer(cfg.chromiumPath);
for (const ref of Object.values(REFERENCE_CONFIGS)) {
  const { config, ev } = recompute(ref, catalog);
  const saved = (await saveRevision(db, tenant.id, null, config, summaryOf(ev)))!;
  for (const view of ['iso_front', 'iso_back', 'front', 'section']) {
    const p = join(root, 'docs/m2/snapshots', `ref-1-${view}.png`);
    if (ref.id === 'ref-1' && existsSync(p)) await saveFile(db, tenant.id, { kind: 'snapshot', name: view, mime: 'image/png', data: readFileSync(p), configId: saved.id, revision: saved.revision });
  }
  const rev = (await getConfigRevision(db, tenant.id, saved.id))!;
  const names: ExportName[] = ['offer.pdf', 'tech.pdf', 'bom.xlsx', 'bom.csv', 'config.json'];
  for (const n of names) {
    const data = await buildExport({ db, pdf, cfg }, tenant, rev, n);
    writeFileSync(join(out, `${ref.id}-${n}`), data);
  }
  console.log(`${ref.id}: ${names.join(', ')}`);
}
await pdf.close();
await close();
