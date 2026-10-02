import { createCatalogIndex, evaluate, normalizeConfig, toPublicCatalog, type Catalog, type Evaluation, type SaunaConfig, type TenantPublic } from '@sauna/core';
import type { Db } from '../db/index.js';
import type { RevisionSummary } from '../db/schema.js';
import { catalogFor, type Tenant } from '../repo.js';

export class HttpError extends Error {
  constructor(readonly status: number, message: string, readonly details?: unknown) {
    super(message);
  }
}

export async function activeCatalog(db: Db, tenant: Tenant): Promise<Catalog> {
  const c = await catalogFor(db, tenant.id, tenant.activeCatalogVersion);
  if (!c) throw new HttpError(500, 'active catalog missing');
  return c;
}

/** Server-side authority (D-043): normalize with the tenant's active catalog and recompute with costs. */
export function recompute(config: SaunaConfig, catalog: Catalog): { config: SaunaConfig; ev: Evaluation } {
  if (config.tenantId !== catalog.tenantId) throw new HttpError(404, 'not found');
  let normalized: SaunaConfig;
  try {
    createCatalogIndex(catalog);
    normalized = normalizeConfig(config, catalog);
    return { config: normalized, ev: evaluate(normalized, catalog) };
  } catch (e) {
    throw new HttpError(422, `configuration cannot be evaluated: ${(e as Error).message}`);
  }
}

export function summaryOf(ev: Evaluation): RevisionSummary {
  return {
    priceTotal: Math.round(ev.price.total),
    priceCost: Math.round(ev.price.cost.total),
    emptyMass_kg: Math.round(ev.mass.empty_kg * 10) / 10,
    errors: ev.violations.filter((v) => v.level === 'error').length,
    warnings: ev.violations.filter((v) => v.level === 'warning').length,
  };
}

/** What the browser may see: no costs, no BOM; price only when the tenant shows it. */
export function publicView(ev: Evaluation, id: string, revision: number) {
  const hidden = ev.price.display.mode === 'hidden';
  return {
    id,
    revision,
    schemaVersion: ev.schemaVersion,
    config: { ...ev.config, id, revision },
    price: hidden ? { display: ev.price.display } : { total: Math.round(ev.price.total), display: ev.price.display },
    violations: ev.violations,
    auto: ev.auto.map((a) => ({ ruleId: a.ruleId, note: a.note, params: a.params })),
    sauna: ev.sauna,
    mass: { empty_kg: Math.round(ev.mass.empty_kg), transport_kg: Math.round(ev.mass.transport_kg) },
    transport: { oversize: ev.transport.oversize, oversizeReasons: ev.transport.oversizeReasons },
    submittable: ev.submittable,
  };
}

export function tenantPublic(tenant: Tenant, catalog: Catalog): TenantPublic {
  const s = tenant.settings;
  return {
    slug: tenant.slug,
    name: tenant.name,
    locales: s.locales,
    defaultLocale: s.defaultLocale,
    currencies: s.currencies,
    defaultCurrency: s.defaultCurrency,
    theme: s.theme,
    catalog: toPublicCatalog(catalog),
    embedOrigins: s.embedOrigins,
  };
}
