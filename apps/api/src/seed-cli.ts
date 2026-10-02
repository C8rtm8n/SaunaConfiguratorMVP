import { openDb } from './db/index.js';
import { readEnv } from './env.js';
import { seedDemo } from './seed.js';

const cfg = readEnv();
const { db, close } = await openDb(cfg.databaseUrl);
const t = await seedDemo(db, { ...(process.env['ADMIN_EMAIL'] ? { adminEmail: process.env['ADMIN_EMAIL'] } : {}) });
console.log(`tenant ${t.slug} (${t.id}) ready`);
await close();
