import { DEMO_CATALOG, DEMO_TENANT } from '@sauna/core/fixtures';
import type { Db } from './db/index.js';
import { addUser, createTenant, tenantBySlug, type Tenant } from './repo.js';

/** Demo tenant "Demo Sauny s.r.o." with the demo catalog and an admin user (idempotent). */
export async function seedDemo(db: Db, opts: { adminEmail?: string; salesEmail?: string; webhookUrl?: string; webhookSecret?: string; notifyEmail?: string } = {}): Promise<Tenant> {
  const existing = await tenantBySlug(db, 'demo');
  if (existing) return existing;
  const t = await createTenant(db, {
    slug: 'demo',
    name: DEMO_TENANT.name,
    catalog: DEMO_CATALOG,
    settings: {
      locales: DEMO_TENANT.locales,
      defaultLocale: DEMO_TENANT.defaultLocale,
      currencies: DEMO_TENANT.currencies,
      defaultCurrency: DEMO_TENANT.defaultCurrency,
      theme: DEMO_TENANT.theme,
      embedOrigins: [],
      notifyEmail: opts.notifyEmail ?? 'poptavky@demo-sauny.example',
      ...(opts.webhookUrl ? { webhookUrl: opts.webhookUrl, webhookSecret: opts.webhookSecret ?? 'change-me' } : {}),
    },
  });
  await addUser(db, t.id, opts.adminEmail ?? 'admin@demo-sauny.example', 'admin');
  if (opts.salesEmail) await addUser(db, t.id, opts.salesEmail, 'sales');
  return t;
}
