import { buildApp } from './app.js';
import { openDb } from './db/index.js';
import { readEnv } from './env.js';
import { seedDemo } from './seed.js';
import { startWorker } from './services/jobs.js';
import { createMailer } from './services/mailer.js';
import { PdfRenderer } from './services/pdf.js';

const cfg = readEnv();
const { db, close } = await openDb(cfg.databaseUrl);
if (!cfg.production || process.env['SEED_DEMO'] === '1') await seedDemo(db);
const mailer = await createMailer(cfg.smtpUrl, cfg.mailFrom);
const pdf = new PdfRenderer(cfg.chromiumPath);
const app = await buildApp({ db, cfg, mailer, pdf });
const stopWorker = startWorker({ db, mailer, pdf, cfg });
await app.listen({ port: cfg.port, host: cfg.host });

const shutdown = async () => {
  stopWorker();
  await app.close();
  await pdf.close();
  await close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
