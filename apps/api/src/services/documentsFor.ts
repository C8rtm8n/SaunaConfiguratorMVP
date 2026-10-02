import type { Evaluation, Locale } from '@sauna/core';
import type { Db } from '../db/index.js';
import type { ApiConfig } from '../env.js';
import { catalogFor, snapshotsFor, type StoredRevision, type Tenant } from '../repo.js';
import { recompute, HttpError } from './evaluate.js';
import { bomCsv, bomXlsx, configJson } from './exports.js';
import { offerHtml, techHtml } from './documents.js';
import type { PdfRenderer } from './pdf.js';

export type ExportName = 'bom.csv' | 'bom.xlsx' | 'config.json' | 'offer.pdf' | 'tech.pdf';
export const EXPORTS: Record<ExportName, string> = {
  'bom.csv': 'text/csv; charset=utf-8',
  'bom.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'config.json': 'application/json; charset=utf-8',
  'offer.pdf': 'application/pdf',
  'tech.pdf': 'application/pdf',
};

/** Recomputes a stored revision with the catalog version it was saved with. */
export async function evaluateRevision(db: Db, tenant: Tenant, rev: StoredRevision): Promise<Evaluation> {
  const catalog = await catalogFor(db, tenant.id, rev.catalogVersion);
  if (!catalog) throw new HttpError(500, `catalog ${rev.catalogVersion} missing`);
  return recompute(rev.config as never, catalog).ev;
}

export function configLink(cfg: ApiConfig, tenant: Tenant, configId: string): string {
  const base = tenant.settings.publicUrl ?? cfg.configuratorUrl;
  const u = new URL(base);
  u.searchParams.set('c', configId);
  if (!tenant.settings.publicUrl) u.searchParams.set('tenant', tenant.slug);
  return u.toString();
}

export async function buildExport(
  deps: { db: Db; pdf: PdfRenderer; cfg: ApiConfig },
  tenant: Tenant,
  rev: StoredRevision,
  name: ExportName,
  locale?: Locale,
): Promise<Buffer> {
  const ev = await evaluateRevision(deps.db, tenant, rev);
  const meta = { tenant: tenant.name, configId: rev.configId, revision: rev.revision };
  switch (name) {
    case 'bom.csv':
      return bomCsv(ev);
    case 'bom.xlsx':
      return bomXlsx(ev, meta);
    case 'config.json':
      return configJson(ev, meta);
    case 'offer.pdf':
    case 'tech.pdf': {
      const catalog = (await catalogFor(deps.db, tenant.id, rev.catalogVersion))!;
      const docMeta = {
        tenant,
        catalog,
        configId: rev.configId,
        revision: rev.revision,
        locale: locale ?? tenant.settings.defaultLocale,
        link: configLink(deps.cfg, tenant, rev.configId),
        snapshots: await snapshotsFor(deps.db, tenant.id, rev.configId, rev.revision),
        date: rev.createdAt,
      };
      return deps.pdf.render(name === 'offer.pdf' ? offerHtml(ev, docMeta) : techHtml(ev, docMeta));
    }
  }
}
