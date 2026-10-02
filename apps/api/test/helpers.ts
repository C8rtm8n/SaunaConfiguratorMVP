import { createServer, type IncomingMessage } from 'node:http';
import type { FastifyInstance } from 'fastify';
import { DEMO_CATALOG } from '@sauna/core/fixtures';
import { buildApp } from '../src/app.js';
import { openDb, type Db } from '../src/db/index.js';
import { readEnv, type ApiConfig } from '../src/env.js';
import { addUser, createTenant, type Tenant } from '../src/repo.js';
import { seedDemo } from '../src/seed.js';
import { MemoryMailer } from '../src/services/mailer.js';
import { PdfRenderer } from '../src/services/pdf.js';

export interface Ctx {
  app: FastifyInstance;
  db: Db;
  cfg: ApiConfig;
  mailer: MemoryMailer;
  pdf: PdfRenderer;
  demo: Tenant;
  other: Tenant;
  hooks: Array<{ headers: IncomingMessage['headers']; body: string }>;
  close(): Promise<void>;
}

/** Fresh in-memory PostgreSQL (PGlite) + demo tenant + a second tenant + webhook receiver. */
export async function setup(): Promise<Ctx> {
  const hooks: Ctx['hooks'] = [];
  const hookServer = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      hooks.push({ headers: req.headers, body });
      res.writeHead(200).end('ok');
    });
  });
  await new Promise<void>((r) => hookServer.listen(0, '127.0.0.1', r));
  const port = (hookServer.address() as { port: number }).port;
  // TEST_DATABASE_URL=postgres://… → a throw-away database on a real PostgreSQL; default: in-memory PGlite.
  const admin = process.env['TEST_DATABASE_URL'];
  let dbUrl = 'pglite://memory';
  let dropDb: (() => Promise<void>) | undefined;
  if (admin) {
    const { default: pg } = await import('pg');
    const name = `sauna_test_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const c = new pg.Client({ connectionString: admin });
    await c.connect();
    await c.query(`CREATE DATABASE ${name}`);
    await c.end();
    const u = new URL(admin);
    u.pathname = `/${name}`;
    dbUrl = u.toString();
    dropDb = async () => {
      const d = new pg.Client({ connectionString: admin });
      await d.connect();
      await d.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await d.end();
    };
  }
  const cfg = { ...readEnv({ NODE_ENV: 'test' }), databaseUrl: dbUrl, publicUrl: 'http://api.test', adminUrl: 'http://admin.test', configuratorUrl: 'http://cfg.test/' };
  const { db, close } = await openDb(cfg.databaseUrl);
  const demo = await seedDemo(db, { salesEmail: 'sales@demo-sauny.example', webhookUrl: `http://127.0.0.1:${port}/hook`, webhookSecret: 's3cret' });
  const other = await createTenant(db, {
    slug: 'other',
    name: 'Jiné Sauny a.s.',
    catalog: { ...DEMO_CATALOG, tenantId: 'other', version: 'other-1' },
    settings: { ...demo.settings, notifyEmail: 'leads@other.example', webhookUrl: undefined as never },
  });
  await addUser(db, other.id, 'admin@other.example', 'admin');
  const mailer = new MemoryMailer();
  const pdf = new PdfRenderer(cfg.chromiumPath);
  const app = await buildApp({ db, cfg, mailer, pdf });
  return {
    app,
    db,
    cfg,
    mailer,
    pdf,
    demo,
    other,
    hooks,
    async close() {
      await app.close();
      await pdf.close();
      await close();
      await dropDb?.();
      hookServer.close();
    },
  };
}

/** Multipart body for app.inject from a FormData. */
export async function multipart(fd: FormData): Promise<{ payload: Buffer; headers: Record<string, string> }> {
  const res = new Response(fd);
  return { payload: Buffer.from(await res.arrayBuffer()), headers: { 'content-type': res.headers.get('content-type')! } };
}

/** Logs a user in via the magic link e-mail; returns the session cookie header. */
const cookies = new WeakMap<Ctx, Map<string, string>>();
export async function login(ctx: Ctx, tenant: string, email: string): Promise<string> {
  const cache = cookies.get(ctx) ?? new Map<string, string>();
  cookies.set(ctx, cache);
  const key = `${tenant}|${email}`;
  if (cache.has(key)) return cache.get(key)!;
  const c = await freshLogin(ctx, tenant, email);
  cache.set(key, c);
  return c;
}

async function freshLogin(ctx: Ctx, tenant: string, email: string): Promise<string> {
  const n = ctx.mailer.outbox.length;
  const r = await ctx.app.inject({ method: 'POST', url: '/auth/magic-link', payload: { tenant, email } });
  if (r.statusCode !== 204) throw new Error(`magic-link ${r.statusCode}`);
  const mail = ctx.mailer.outbox[n];
  if (!mail) throw new Error('no magic link mail');
  const token = /token=([\w-]+)/.exec(mail.text)![1]!;
  const v = await ctx.app.inject({ method: 'GET', url: `/auth/verify?token=${token}` });
  const set = String(v.headers['set-cookie']);
  return set.split(';')[0]!;
}
