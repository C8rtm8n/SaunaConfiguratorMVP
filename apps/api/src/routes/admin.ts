import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { validateCatalog, sheetsToCatalog, type Catalog } from '@sauna/core';
import { requireUser } from '../auth.js';
import type { Db } from '../db/index.js';
import { files, type TenantSettings } from '../db/schema.js';
import type { ApiConfig } from '../env.js';
import { catalogFor, getConfigRevision, getLead, listCatalogVersions, listRevisions, publishCatalog, tenantById, updateTenant } from '../repo.js';
import { catalogXlsx, diffCatalog, parseCatalogXlsx } from '../services/catalogAdmin.js';
import { configLink } from '../services/documentsFor.js';
import { HttpError, activeCatalog, publicView, recompute } from '../services/evaluate.js';

/**
 * Admin API for apps/admin (D-051). Reads: admin + sales; writes (catalog, settings): admin only.
 * The tenant always comes from the session.
 */
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const httpsOrData = z
  .string()
  .max(400_000)
  .refine((s) => s === '' || /^https:\/\//.test(s) || /^data:image\/(png|jpeg|webp|svg\+xml);base64,/.test(s), 'https:// or data:image URL');

const settingsSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  theme: z
    .object({
      primary: hex, primaryText: hex, background: hex, surface: hex, text: hex, muted: hex, danger: hex, warning: hex,
      radius_px: z.number().int().min(0).max(40),
      fontFamily: z.string().max(200).regex(/^[\w\s,"'-]+$/),
      fontCss: z.string().max(400).regex(/^https:\/\/fonts\.googleapis\.com\//).optional().or(z.literal('')),
      logoUrl: httpsOrData.optional(),
      posterUrl: httpsOrData.optional(),
    })
    .optional(),
  locales: z.array(z.enum(['cs', 'de', 'en'])).min(1).optional(),
  defaultLocale: z.enum(['cs', 'de', 'en']).optional(),
  currencies: z.array(z.enum(['CZK', 'EUR'])).min(1).optional(),
  defaultCurrency: z.enum(['CZK', 'EUR']).optional(),
  embedOrigins: z.array(z.string().regex(/^https?:\/\/[^/\s]+$/)).max(20).optional(),
  notifyEmail: z.string().email().max(200).optional(),
  webhookUrl: z.string().url().max(500).regex(/^https?:\/\//).optional().or(z.literal('')),
  /** Write-only; omitted or empty = keep the current secret. */
  webhookSecret: z.string().max(200).optional(),
  publicUrl: z.string().url().max(500).optional().or(z.literal('')),
});

function maskSettings(s: TenantSettings) {
  const { webhookSecret, ...rest } = s;
  return { ...rest, hasWebhookSecret: !!webhookSecret };
}

export function registerAdmin(app: FastifyInstance, deps: { db: Db; cfg: ApiConfig }): void {
  const { db, cfg } = deps;
  const read = requireUser(db);
  const write = requireUser(db, ['admin']);
  const tenantOf = async (tenantId: string) => (await tenantById(db, tenantId))!;

  // ------------------------------------------------------------- tenant
  app.get('/admin/tenant', { preHandler: read }, async (req) => {
    const t = await tenantOf(req.user!.tenantId);
    return { slug: t.slug, name: t.name, settings: maskSettings(t.settings), activeCatalogVersion: t.activeCatalogVersion, versions: await listCatalogVersions(db, t.id), role: req.user!.role };
  });

  app.patch('/admin/tenant', { preHandler: write }, async (req) => {
    const p = settingsSchema.parse(req.body);
    const t = await tenantOf(req.user!.tenantId);
    const { name, webhookSecret, ...rest } = p;
    const settings: TenantSettings = { ...t.settings, ...rest, theme: { ...t.settings.theme, ...(rest.theme ?? {}) } } as TenantSettings;
    if (webhookSecret) settings.webhookSecret = webhookSecret;
    if (settings.webhookUrl === '') delete settings.webhookUrl;
    if (settings.publicUrl === '') delete settings.publicUrl;
    if (!settings.locales.includes(settings.defaultLocale)) throw new HttpError(400, 'defaultLocale must be one of locales');
    if (!settings.currencies.includes(settings.defaultCurrency)) throw new HttpError(400, 'defaultCurrency must be one of currencies');
    await updateTenant(db, t.id, { ...(name ? { name } : {}), settings });
    return { ok: true, settings: maskSettings(settings) };
  });

  // ------------------------------------------------------------ catalog
  app.get('/admin/catalog', { preHandler: read }, async (req) => {
    const t = await tenantOf(req.user!.tenantId);
    const v = (req.query as { version?: string }).version ?? t.activeCatalogVersion;
    const c = await catalogFor(db, t.id, v);
    if (!c) throw new HttpError(404, 'not found');
    return c;
  });

  /** Publishes a new catalog version (or only validates with dryRun). */
  const publish = async (tenantId: string, next: Catalog, dryRun: boolean) => {
    const t = await tenantOf(tenantId);
    const current = await activeCatalog(db, t);
    const candidate: Catalog = { ...next, tenantId: t.slug, version: current.version, pricing: 'cost' };
    const issues = validateCatalog(candidate);
    const diff = diffCatalog(current, candidate);
    if (issues.some((i) => i.level === 'error')) return { status: 422, body: { error: 'catalog invalid', issues, diff } };
    if (dryRun) return { status: 200, body: { dryRun: true, issues, diff } };
    const version = await publishCatalog(db, t.id, t.slug, candidate);
    return { status: 201, body: { version, issues, diff } };
  };

  app.post('/admin/catalog', { preHandler: write, bodyLimit: 4 * 1024 * 1024 }, async (req, reply) => {
    const b = z.object({ catalog: z.record(z.string(), z.unknown()), dryRun: z.boolean().optional() }).parse(req.body);
    const r = await publish(req.user!.tenantId, b.catalog as unknown as Catalog, !!b.dryRun);
    return reply.code(r.status).send(r.body);
  });

  app.get('/admin/catalog/export.xlsx', { preHandler: read }, async (req, reply) => {
    const t = await tenantOf(req.user!.tenantId);
    const v = (req.query as { version?: string }).version ?? t.activeCatalogVersion;
    const c = await catalogFor(db, t.id, v);
    if (!c) throw new HttpError(404, 'not found');
    reply.header('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    reply.header('content-disposition', `attachment; filename="katalog-${v}.xlsx"`);
    return reply.send(await catalogXlsx(c));
  });

  /** XLSX import: multipart `file` + optional field `dryRun=1`. Missing sheets keep current values. */
  app.post('/admin/catalog/import', { preHandler: write }, async (req, reply) => {
    let data: Buffer | undefined;
    let dryRun = false;
    for await (const part of req.parts()) {
      if (part.type === 'field') {
        if (part.fieldname === 'dryRun') dryRun = String(part.value) === '1' || String(part.value) === 'true';
      } else if (part.fieldname === 'file') data = await part.toBuffer();
    }
    if (!data) throw new HttpError(400, 'missing file');
    const t = await tenantOf(req.user!.tenantId);
    let next: Catalog;
    try {
      next = sheetsToCatalog(await parseCatalogXlsx(data), await activeCatalog(db, t));
    } catch (e) {
      throw new HttpError(400, `XLSX nelze přečíst: ${(e as Error).message}`);
    }
    const r = await publish(t.id, next, dryRun);
    return reply.code(r.status).send(r.body);
  });

  // -------------------------------------------------------------- leads
  app.get('/admin/leads/:id/detail', { preHandler: read }, async (req) => {
    const t = await tenantOf(req.user!.tenantId);
    const lead = await getLead(db, t.id, (req.params as { id: string }).id);
    if (!lead) throw new HttpError(404, 'not found');
    const rev = (await getConfigRevision(db, t.id, lead.configId, lead.revision))!;
    const catalog = (await catalogFor(db, t.id, rev.catalogVersion))!;
    const { ev } = recompute(rev.config as never, catalog);
    const fl = await db
      .select({ id: files.id, kind: files.kind, name: files.name, size: files.size, mime: files.mime })
      .from(files)
      .where(and(eq(files.tenantId, t.id), eq(files.configId, lead.configId), eq(files.revision, lead.revision)));
    return {
      lead,
      revision: { revision: rev.revision, catalogVersion: rev.catalogVersion, summary: rev.summary, createdAt: rev.createdAt },
      revisions: await listRevisions(db, t.id, lead.configId),
      evaluation: { ...publicView(ev, rev.configId, rev.revision), price: { total: Math.round(ev.price.total), cost: Math.round(ev.price.cost.total), display: ev.price.display } },
      files: fl.filter((f) => f.kind !== 'snapshot'),
      snapshots: fl.filter((f) => f.kind === 'snapshot').map((f) => ({ id: f.id, view: f.name })),
      link: configLink(cfg, t, lead.configId),
    };
  });
}
