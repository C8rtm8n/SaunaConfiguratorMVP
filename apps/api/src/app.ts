import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import { ZodError, z } from 'zod';
import type { Locale } from '@sauna/core';
import { SESSION_COOKIE, consumeMagicLink, createMagicLink, destroySession, requireUser, userForSession } from './auth.js';
import type { Db } from './db/index.js';
import type { ApiConfig } from './env.js';
import {
  createLead,
  enqueue,
  getConfigRevision,
  getFile,
  getLead,
  listLeads,
  listRevisions,
  saveFile,
  saveRevision,
  tenantById,
  tenantBySlug,
  updateLead,
} from './repo.js';
import { EXPORTS, buildExport, type ExportName } from './services/documentsFor.js';
import { HttpError, activeCatalog, publicView, recompute, summaryOf, tenantPublic } from './services/evaluate.js';
import { MemoryMailer, type Mailer } from './services/mailer.js';
import type { PdfRenderer } from './services/pdf.js';
import { IMAGE_MIME, SNAPSHOT_VIEWS, UPLOAD_LIMITS, leadPayloadSchema, parseConfig } from './validation.js';

export interface AppDeps {
  db: Db;
  cfg: ApiConfig;
  mailer: Mailer;
  pdf: PdfRenderer;
}

const ADMIN_PREFIXES = ['/auth', '/admin'];
const isAdminPath = (url: string) => ADMIN_PREFIXES.some((p) => url.startsWith(p)) || /^\/configs\/[^/]+\/exports\//.test(url);

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const { db, cfg, mailer } = deps;
  const app = Fastify({ logger: cfg.production ? { level: 'info' } : false, bodyLimit: 512 * 1024, trustProxy: true });

  await app.register(cookie);
  // Public endpoints: any origin, no credentials. Admin endpoints: admin origin with credentials.
  await app.register(cors, {
    delegator: (req, cb) => {
      const url = req.url ?? '';
      if (isAdminPath(url)) cb(null, { origin: [cfg.adminUrl], credentials: true, methods: ['GET', 'POST', 'PATCH', 'DELETE'] });
      else cb(null, { origin: true, credentials: false, methods: ['GET', 'POST', 'PUT'] });
    },
  });
  await app.register(rateLimit, { global: false });
  await app.register(multipart, { limits: { fileSize: UPLOAD_LIMITS.photoBytes, files: UPLOAD_LIMITS.files, fields: 4, fieldSize: 512 * 1024 } });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) return reply.code(400).send({ error: 'invalid input', issues: err.issues.slice(0, 20).map((i) => ({ path: i.path.join('.'), message: i.message })) });
    if (err instanceof HttpError) return reply.code(err.status).send({ error: err.message, ...(err.details ? { details: err.details } : {}) });
    const status = (err as { statusCode?: number }).statusCode;
    if (status && status < 500) return reply.code(status).send({ error: (err as Error).message });
    req.log.error(err);
    return reply.code(500).send({ error: 'internal error' });
  });

  const tenantOr404 = async (slug: unknown) => {
    const t = typeof slug === 'string' ? await tenantBySlug(db, slug) : undefined;
    if (!t) throw new HttpError(404, 'not found');
    return t;
  };

  app.get('/health', async () => ({ ok: true }));

  // ------------------------------------------------------------- public
  app.get('/tenants/:slug/public', async (req, reply) => {
    const t = await tenantOr404((req.params as { slug: string }).slug);
    reply.header('cache-control', 'public, max-age=60');
    return tenantPublic(t, await activeCatalog(db, t));
  });

  const writeLimit = { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } };

  /** New config: tenant = config.tenantId (slug). Server recomputes and stores revision 1. */
  app.post('/configs', writeLimit, async (req, reply) => {
    const input = parseConfig(req.body);
    const t = await tenantOr404(input.tenantId);
    const { config, ev } = recompute(input, await activeCatalog(db, t));
    const saved = (await saveRevision(db, t.id, null, config, summaryOf(ev)))!;
    return reply.code(201).send(publicView(ev, saved.id, saved.revision));
  });

  app.put('/configs/:id', writeLimit, async (req) => {
    const { id } = req.params as { id: string };
    const t = await tenantOr404((req.query as { tenant?: string }).tenant);
    const input = parseConfig(req.body);
    if (input.tenantId !== t.slug) throw new HttpError(404, 'not found');
    const { config, ev } = recompute(input, await activeCatalog(db, t));
    const saved = await saveRevision(db, t.id, id, config, summaryOf(ev));
    if (!saved) throw new HttpError(404, 'not found');
    return publicView(ev, saved.id, saved.revision);
  });

  /** Shared link: no costs; the tenant must match (no cross-tenant probing by id). */
  app.get('/configs/:id', async (req) => {
    const { id } = req.params as { id: string };
    const q = req.query as { tenant?: string; revision?: string };
    const t = await tenantOr404(q.tenant);
    const rev = await getConfigRevision(db, t.id, id, q.revision ? Number(q.revision) : undefined);
    if (!rev) throw new HttpError(404, 'not found');
    const { ev } = recompute(rev.config as never, await activeCatalog(db, t));
    return publicView({ ...ev, config: rev.config as never }, rev.configId, rev.revision);
  });

  /** Lead: multipart (payload JSON, optional photo and snapshot_<view> PNGs). Rejects configs with errors. */
  app.post('/leads', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    let payloadRaw: string | undefined;
    const uploads: Array<{ field: string; name: string; mime: string; data: Buffer }> = [];
    for await (const part of req.parts()) {
      if (part.type === 'field') {
        if (part.fieldname === 'payload') payloadRaw = String(part.value);
        continue;
      }
      const data = await part.toBuffer();
      if (part.file.truncated) throw new HttpError(413, 'file too large');
      uploads.push({ field: part.fieldname, name: part.filename, mime: part.mimetype, data });
    }
    if (!payloadRaw) throw new HttpError(400, 'missing payload');
    const p = leadPayloadSchema.parse(JSON.parse(payloadRaw));
    const t = await tenantOr404(p.tenant);
    const input = parseConfig(p.config);
    if (input.tenantId !== t.slug) throw new HttpError(404, 'not found');
    const { config, ev } = recompute(input, await activeCatalog(db, t));
    if (!ev.submittable) throw new HttpError(422, 'configuration has errors', ev.violations.filter((v) => v.level === 'error').map((v) => v.ruleId));
    // Existing config of this tenant → new revision; otherwise a new config.
    const existing = config.id && config.id !== 'new' ? await getConfigRevision(db, t.id, config.id) : undefined;
    const saved = (await saveRevision(db, t.id, existing ? config.id : null, config, summaryOf(ev)))!;
    let photoFileId: string | undefined;
    for (const u of uploads) {
      if (!IMAGE_MIME.includes(u.mime)) throw new HttpError(415, 'unsupported file type');
      if (u.field === 'photo') {
        photoFileId = await saveFile(db, t.id, { kind: 'photo', name: u.name.slice(0, 120) || 'photo', mime: u.mime, data: u.data, configId: saved.id, revision: saved.revision });
      } else if (u.field.startsWith('snapshot_')) {
        const view = u.field.slice('snapshot_'.length);
        if (!(SNAPSHOT_VIEWS as readonly string[]).includes(view) || u.data.length > UPLOAD_LIMITS.snapshotBytes) continue;
        await saveFile(db, t.id, { kind: 'snapshot', name: view, mime: u.mime, data: u.data, configId: saved.id, revision: saved.revision });
      }
    }
    const { consent: _c, ...contact } = p.contact;
    const leadId = await createLead(db, t.id, { configId: saved.id, revision: saved.revision, contact, locale: p.locale, priceTotal: ev.price.total, ...(photoFileId ? { photoFileId } : {}) });
    await enqueue(db, t.id, 'lead.process', { leadId });
    return reply.code(201).send({ leadId, configId: saved.id, revision: saved.revision });
  });

  // --------------------------------------------------------------- auth
  app.post('/auth/magic-link', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (req, reply) => {
    const b = z.object({ tenant: z.string().max(64), email: z.string().email().max(200) }).parse(req.body);
    const t = await tenantBySlug(db, b.tenant);
    const raw = t ? await createMagicLink(db, t.id, b.email, cfg.magicLinkTtlMinutes) : null;
    if (raw && t) {
      const link = `${cfg.publicUrl}/auth/verify?token=${encodeURIComponent(raw)}`;
      await mailer.send({ to: b.email, subject: `Přihlášení – ${t.name}`, text: `Přihlaste se do administrace (odkaz platí ${cfg.magicLinkTtlMinutes} minut, jen jednou):\n${link}\n` });
    }
    return reply.code(204).send(); // same answer for unknown e-mails (no enumeration)
  });

  app.get('/auth/verify', async (req, reply) => {
    const { token } = z.object({ token: z.string().min(20).max(200) }).parse(req.query);
    const s = await consumeMagicLink(db, token, cfg.sessionTtlHours);
    if (!s) return reply.code(401).type('text/plain; charset=utf-8').send('Odkaz je neplatný nebo vypršel.');
    reply.setCookie(SESSION_COOKIE, s, { httpOnly: true, sameSite: 'lax', secure: cfg.production, path: '/', maxAge: cfg.sessionTtlHours * 3600 });
    return reply.redirect(cfg.adminUrl, 302);
  });

  app.post('/auth/logout', async (req, reply) => {
    await destroySession(db, req.cookies[SESSION_COOKIE]);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return reply.code(204).send();
  });

  app.get('/auth/me', async (req, reply) => {
    const u = await userForSession(db, req.cookies[SESSION_COOKIE]);
    if (!u) return reply.code(401).send({ error: 'unauthorized' });
    const t = (await tenantById(db, u.tenantId))!;
    return { ...u, tenant: { slug: t.slug, name: t.name } };
  });

  // -------------------------------------------------------------- admin
  const auth = requireUser(db);

  app.get('/configs/:id/exports/:name', { preHandler: auth }, async (req, reply) => {
    const { id, name } = req.params as { id: string; name: string };
    if (!(name in EXPORTS)) throw new HttpError(404, 'not found');
    const q = req.query as { revision?: string; lang?: string };
    const t = (await tenantById(db, req.user!.tenantId))!;
    const rev = await getConfigRevision(db, t.id, id, q.revision ? Number(q.revision) : undefined);
    if (!rev) throw new HttpError(404, 'not found');
    const lang = (['cs', 'de', 'en'] as const).find((l) => l === q.lang) as Locale | undefined;
    const data = await buildExport(deps, t, rev, name as ExportName, lang);
    reply.header('content-type', EXPORTS[name as ExportName]);
    reply.header('content-disposition', `attachment; filename="${id}-r${rev.revision}-${name}"`);
    reply.header('cache-control', 'private, no-store');
    return reply.send(data);
  });

  app.get('/admin/configs/:id/revisions', { preHandler: auth }, async (req) => listRevisions(db, req.user!.tenantId, (req.params as { id: string }).id));

  app.get('/admin/leads', { preHandler: auth }, async (req) => {
    const rows = await listLeads(db, req.user!.tenantId);
    return rows.map(({ ...l }) => l);
  });

  app.get('/admin/leads/:id', { preHandler: auth }, async (req) => {
    const l = await getLead(db, req.user!.tenantId, (req.params as { id: string }).id);
    if (!l) throw new HttpError(404, 'not found');
    return l;
  });

  app.patch('/admin/leads/:id', { preHandler: auth }, async (req) => {
    const { status } = z.object({ status: z.enum(['new', 'negotiating', 'won', 'lost']) }).parse(req.body);
    const ok = await updateLead(db, req.user!.tenantId, (req.params as { id: string }).id, { status });
    if (!ok) throw new HttpError(404, 'not found');
    return { ok: true };
  });

  app.get('/admin/files/:id', { preHandler: auth }, async (req, reply) => {
    const f = await getFile(db, req.user!.tenantId, (req.params as { id: string }).id);
    if (!f) throw new HttpError(404, 'not found');
    reply.header('content-type', f.mime).header('content-disposition', `attachment; filename="${f.name}"`).header('cache-control', 'private, no-store');
    return reply.send(f.data);
  });

  // ---------------------------------------------------------------- dev
  if (!cfg.production && mailer instanceof MemoryMailer) {
    app.get('/dev/outbox', async () => mailer.outbox.map((m) => ({ to: m.to, subject: m.subject, text: m.text, attachments: (m.attachments ?? []).map((a) => ({ filename: a.filename, size: a.content.length })), at: m.at })));
  }
  return app;
}
