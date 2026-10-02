import { sql } from 'drizzle-orm';
import { bigint, boolean, customType, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import type { Catalog, Config, Currency, Locale, TenantTheme } from '@sauna/core';

/**
 * Every tenant-owned row carries tenant_id and every query filters by it
 * (repository layer, D-042). IDs exposed publicly are random, never sequential.
 */

const bytea = customType<{ data: Buffer; driverData: Buffer | Uint8Array }>({
  dataType: () => 'bytea',
  fromDriver: (v) => (Buffer.isBuffer(v) ? v : Buffer.from(v)),
});

export const role = pgEnum('role', ['admin', 'sales']);
export const leadStatus = pgEnum('lead_status', ['new', 'negotiating', 'won', 'lost']);
export const jobStatus = pgEnum('job_status', ['pending', 'running', 'done', 'failed']);

export interface TenantSettings {
  locales: Locale[];
  defaultLocale: Locale;
  currencies: Currency[];
  defaultCurrency: Currency;
  theme: TenantTheme;
  embedOrigins: string[];
  /** Manufacturer inbox for leads. */
  notifyEmail: string;
  /** Lead webhook (optional), signed with HMAC-SHA256. */
  webhookUrl?: string;
  webhookSecret?: string;
  /** Public URL of the configurator / tenant website for links in PDFs and e-mails. */
  publicUrl?: string;
}

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  settings: jsonb('settings').$type<TenantSettings>().notNull(),
  activeCatalogVersion: text('active_catalog_version').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Immutable catalog versions (a stored config can always be recomputed with its version). */
export const catalogVersions = pgTable(
  'catalog_versions',
  {
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    version: text('version').notNull(),
    catalog: jsonb('catalog').$type<Catalog>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.version] })],
);

export const configs = pgTable(
  'configs',
  {
    id: text('id').primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    currentRevision: integer('current_revision').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('configs_tenant_idx').on(t.tenantId)],
);

export interface RevisionSummary {
  priceTotal: number;
  priceCost: number;
  emptyMass_kg: number;
  errors: number;
  warnings: number;
}

export const configRevisions = pgTable(
  'config_revisions',
  {
    configId: text('config_id').notNull().references(() => configs.id),
    revision: integer('revision').notNull(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    catalogVersion: text('catalog_version').notNull(),
    config: jsonb('config').$type<Config>().notNull(),
    summary: jsonb('summary').$type<RevisionSummary>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.configId, t.revision] }), index('rev_tenant_idx').on(t.tenantId)],
);

export const files = pgTable(
  'files',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    kind: text('kind').notNull(), // photo | snapshot | offer_pdf | tech_pdf | bom_xlsx
    name: text('name').notNull(),
    mime: text('mime').notNull(),
    size: bigint('size', { mode: 'number' }).notNull(),
    data: bytea('data').notNull(),
    configId: text('config_id'),
    revision: integer('revision'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('files_tenant_idx').on(t.tenantId), index('files_config_idx').on(t.configId, t.revision)],
);

export interface LeadContact {
  name: string;
  email: string;
  phone: string;
  postalCode: string;
  term: string;
  budget: string;
  note: string;
}

export const leads = pgTable(
  'leads',
  {
    id: text('id').primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    configId: text('config_id').notNull().references(() => configs.id),
    revision: integer('revision').notNull(),
    status: leadStatus('status').notNull().default('new'),
    contact: jsonb('contact').$type<LeadContact>().notNull(),
    locale: text('locale').notNull(),
    priceTotal: integer('price_total').notNull(),
    photoFileId: uuid('photo_file_id'),
    offerPdfFileId: uuid('offer_pdf_file_id'),
    techPdfFileId: uuid('tech_pdf_file_id'),
    bomXlsxFileId: uuid('bom_xlsx_file_id'),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('leads_tenant_idx').on(t.tenantId, t.createdAt)],
);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    email: text('email').notNull(),
    role: role('role').notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('users_tenant_email').on(t.tenantId, sql`lower(${t.email})`)],
);

/** Only SHA-256 hashes of tokens are stored. */
export const magicLinks = pgTable('magic_links', {
  tokenHash: text('token_hash').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
});

export const sessions = pgTable('sessions', {
  tokenHash: text('token_hash').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** DB-backed job queue (lead processing, e-mails, webhooks) with retries. */
export const jobs = pgTable(
  'jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    type: text('type').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    status: jobStatus('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    runAt: timestamp('run_at', { withTimezone: true }).notNull().defaultNow(),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('jobs_due_idx').on(t.status, t.runAt)],
);
