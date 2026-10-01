import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluate } from '../src/evaluate.js';
import { DEMO_CATALOG } from '../src/fixtures/demoCatalog.js';
import { REFERENCE_CONFIGS } from '../src/fixtures/referenceConfigs.js';
import { evaluationReport } from '../src/report/markdown.js';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '../../../docs/reference');
mkdirSync(outDir, { recursive: true });
for (const [name, cfg] of Object.entries(REFERENCE_CONFIGS)) {
  const md = evaluationReport(evaluate(cfg, DEMO_CATALOG), name);
  writeFileSync(join(outDir, `${cfg.id}.md`), md + '\n');
  console.log(`docs/reference/${cfg.id}.md`);
}
