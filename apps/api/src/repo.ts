import { randomBytes } from 'node:crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { Catalog, Config } from '@sauna/core';
import type { Db } from './db/index.js';
import { catalogVersions, configRevisions, configs, files, jobs, leads, tenants, users, type LeadContact, type RevisionSummary, type TenantSettings } from './db/schema.js';

/**
 * Data access. Every function that touches tenant data takes `tenantId` and
 * filters by it (D-042); there is no way to read another tenant's rows by id alone.
 */

export const newId = (prefix: string) => `${prefix}${randomBytes(12).toString('base64url').replace(/[-_]/g, '').slice(0, 14).toLowerCase()}`;

export type Tenant = typeof tenants.$inferSelect;

export async function tenantBySlug(db: Db, slug: string): Promise<Tenant | undefined> {
  return (await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1))[0];
}

export async function tenantById(db: Db, id: string): Promise<Tenant | undefined> {
  return (await db.select().from(tenants).where(eq(tenants.id, id)).limit(1))[0];
}

export async function catalogFor(db: Db, tenantId: string, version: string): Promise<Catalog | undefined> {
  const r = await db
    .select({ catalog: catalogVersions.catalog })
    .from(catalogVersions)
    .where(and(eq(catalogVersions.tenantId, tenantId), eq(catalogVersions.version, version)))
    .limit(1);
  return r[0]?.catalog;
}

export async function createTenant(db: Db, t: { slug: string; name: string; settings: TenantSettings; catalog: Catalog }): Promise<Tenant> {
  const [row] = await db.insert(tenants).values({ slug: t.slug, name: t.name, settings: t.settings, activeCatalogVersion: t.catalog.version }).returning();
  await db.insert(catalogVersions).values({ tenantId: row!.id, version: t.catalog.version, catalog: t.catalog });
  return row!;
}

export async function addUser(db: Db, tenantId: string, email: string, role: 'admin' | 'sales') {
  const [u] = await db.insert(users).values({ tenantId, email: email.toLowerCase(), role }).returning();
  return u!;
}

// ------------------------------------------------------------------ configs

export interface StoredRevision {
  configId: string;
  revision: number;
  catalogVersion: string;
  config: Config;
  summary: RevisionSummary;
  createdAt: Date;
}

export async function getConfigRevision(db: Db, tenantId: string, configId: string, revision?: number): Promise<StoredRevision | undefined> {
  const head = (await db.select().from(configs).where(and(eq(configs.id, configId), eq(configs.tenantId, tenantId))).limit(1))[0];
  if (!head) return undefined;
  const r = (
    await db
      .select()
      .from(configRevisions)
      .where(and(eq(configRevisions.configId, configId), eq(configRevisions.tenantId, tenantId), eq(configRevisions.revision, revision ?? head.currentRevision)))
      .limit(1)
  )[0];
  return r ? { configId: r.configId, revision: r.revision, catalogVersion: r.catalogVersion, config: r.config, summary: r.summary, createdAt: r.createdAt } : undefined;
}

export async function listRevisions(db: Db, tenantId: string, configId: string) {
  return db
    .select({ revision: configRevisions.revision, createdAt: configRevisions.createdAt, summary: configRevisions.summary })
    .from(configRevisions)
    .where(and(eq(configRevisions.configId, configId), eq(configRevisions.tenantId, tenantId)))
    .orderBy(desc(configRevisions.revision));
}

/** Creates a config (id = null) or appends a revision to an existing one of the same tenant. */
export async function saveRevision(db: Db, tenantId: string, configId: string | null, config: Config, summary: RevisionSummary): Promise<{ id: string; revision: number } | null> {
  return db.transaction(async (tx) => {
    let id = configId;
    let revision = 1;
    if (id) {
      const head = (await tx.select().from(configs).where(and(eq(configs.id, id), eq(configs.tenantId, tenantId))).for('update').limit(1))[0];
      if (!head) return null;
      revision = head.currentRevision + 1;
      await tx.update(configs).set({ currentRevision: revision, updatedAt: new Date() }).where(and(eq(configs.id, id), eq(configs.tenantId, tenantId)));
    } else {
      id = newId('c');
      await tx.insert(configs).values({ id, tenantId, currentRevision: 1 });
    }
    const stored = { ...config, id, revision } as Config;
    await tx.insert(configRevisions).values({ configId: id, revision, tenantId, catalogVersion: config.catalogVersion, config: stored, summary });
    return { id, revision };
  });
}

// -------------------------------------------------------------------- files

export async function saveFile(db: Db, tenantId: string, f: { kind: string; name: string; mime: string; data: Buffer; configId?: string; revision?: number }): Promise<string> {
  const [row] = await db
    .insert(files)
    .values({ tenantId, kind: f.kind, name: f.name, mime: f.mime, size: f.data.length, data: f.data, configId: f.configId ?? null, revision: f.revision ?? null })
    .returning({ id: files.id });
  return row!.id;
}

export async function getFile(db: Db, tenantId: string, id: string) {
  return (await db.select().from(files).where(and(eq(files.id, id), eq(files.tenantId, tenantId))).limit(1))[0];
}

/** Snapshots of a revision (latest upload per view). */
export async function snapshotsFor(db: Db, tenantId: string, configId: string, revision: number): Promise<Record<string, Buffer>> {
  const rows = await db
    .select({ name: files.name, data: files.data, mime: files.mime })
    .from(files)
    .where(and(eq(files.tenantId, tenantId), eq(files.configId, configId), eq(files.revision, revision), eq(files.kind, 'snapshot')))
    .orderBy(files.createdAt);
  const out: Record<string, Buffer> = {};
  for (const r of rows) out[r.name] = r.data;
  return out;
}

// -------------------------------------------------------------------- leads

export type Lead = typeof leads.$inferSelect;

export async function createLead(db: Db, tenantId: string, l: { configId: string; revision: number; contact: LeadContact; locale: string; priceTotal: number; photoFileId?: string }): Promise<string> {
  const id = newId('l');
  await db.insert(leads).values({ id, tenantId, configId: l.configId, revision: l.revision, contact: l.contact, locale: l.locale, priceTotal: Math.round(l.priceTotal), photoFileId: l.photoFileId ?? null });
  return id;
}

export async function getLead(db: Db, tenantId: string, id: string): Promise<Lead | undefined> {
  return (await db.select().from(leads).where(and(eq(leads.id, id), eq(leads.tenantId, tenantId))).limit(1))[0];
}

export async function listLeads(db: Db, tenantId: string, limit = 100) {
  return db.select().from(leads).where(eq(leads.tenantId, tenantId)).orderBy(desc(leads.createdAt)).limit(limit);
}

export async function updateLead(db: Db, tenantId: string, id: string, patch: Partial<Pick<Lead, 'status' | 'offerPdfFileId' | 'techPdfFileId' | 'bomXlsxFileId' | 'deliveredAt'>>): Promise<boolean> {
  const r = await db.update(leads).set(patch).where(and(eq(leads.id, id), eq(leads.tenantId, tenantId))).returning({ id: leads.id });
  return r.length > 0;
}

// --------------------------------------------------------------------- jobs

export async function enqueue(db: Db, tenantId: string, type: string, payload: Record<string, unknown>, delayMs = 0): Promise<void> {
  await db.insert(jobs).values({ tenantId, type, payload, runAt: new Date(Date.now() + delayMs) });
}

export { sql };
