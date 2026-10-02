import { createHmac, timingSafeEqual } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import type { Locale } from '@sauna/core';
import { rows, type Db } from '../db/index.js';
import { jobs } from '../db/schema.js';
import type { ApiConfig } from '../env.js';
import { enqueue, getConfigRevision, getFile, getLead, saveFile, tenantById, updateLead } from '../repo.js';
import { buildExport, configLink } from './documentsFor.js';
import type { Mailer } from './mailer.js';
import type { PdfRenderer } from './pdf.js';

export interface JobDeps {
  db: Db;
  mailer: Mailer;
  pdf: PdfRenderer;
  cfg: ApiConfig;
  fetch?: typeof fetch;
}

interface JobRow {
  id: string;
  tenant_id: string;
  type: string;
  payload: Record<string, unknown>;
  attempts: number;
}

const MAX_ATTEMPTS = 6;
const backoffMs = (attempt: number) => Math.min(60 * 60_000, 5_000 * 2 ** (attempt - 1));

/** Atomically claims the next due job (FOR UPDATE SKIP LOCKED → safe with several API instances). */
async function claim(db: Db): Promise<JobRow | undefined> {
  const r = await db.execute(sql`
    UPDATE jobs SET status = 'running', attempts = attempts + 1
    WHERE id = (SELECT id FROM jobs WHERE status = 'pending' AND run_at <= now() ORDER BY run_at FOR UPDATE SKIP LOCKED LIMIT 1)
    RETURNING id, tenant_id, type, payload, attempts`);
  return rows<JobRow>(r)[0];
}

export async function runOne(deps: JobDeps): Promise<boolean> {
  const job = await claim(deps.db);
  if (!job) return false;
  try {
    const handler = HANDLERS[job.type];
    if (!handler) throw new Error(`unknown job type ${job.type}`);
    await handler(deps, job.tenant_id, job.payload);
    await deps.db.update(jobs).set({ status: 'done', lastError: null }).where(eq(jobs.id, job.id));
  } catch (e) {
    const failed = job.attempts >= MAX_ATTEMPTS;
    await deps.db
      .update(jobs)
      .set({ status: failed ? 'failed' : 'pending', lastError: String((e as Error).stack ?? e).slice(0, 2000), runAt: new Date(Date.now() + backoffMs(job.attempts)) })
      .where(eq(jobs.id, job.id));
  }
  return true;
}

/** Processes all due jobs (tests, CLI). */
export async function drain(deps: JobDeps, max = 50): Promise<number> {
  let n = 0;
  while (n < max && (await runOne(deps))) n++;
  return n;
}

export function startWorker(deps: JobDeps): () => void {
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  const loop = async () => {
    if (stopped) return;
    try {
      while (!stopped && (await runOne(deps)));
    } catch {
      /* DB hiccup – retry on the next tick */
    }
    if (!stopped) timer = setTimeout(loop, deps.cfg.workerIntervalMs);
  };
  timer = setTimeout(loop, 0);
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}

// ------------------------------------------------------------------ handlers

const MAIL = {
  cs: { subjectCustomer: 'Vaše poptávka sauny', bodyCustomer: 'Dobrý den,\n\nděkujeme za poptávku. V příloze najdete orientační nabídku. Konfiguraci můžete kdykoli otevřít zde:\n{link}\n\nS pozdravem\n{tenant}' },
  de: { subjectCustomer: 'Ihre Sauna-Anfrage', bodyCustomer: 'Guten Tag,\n\nvielen Dank für Ihre Anfrage. Im Anhang finden Sie das Richtangebot. Ihre Konfiguration:\n{link}\n\nMit freundlichen Grüßen\n{tenant}' },
  en: { subjectCustomer: 'Your sauna enquiry', bodyCustomer: 'Hello,\n\nthank you for your enquiry. The indicative offer is attached. Your configuration:\n{link}\n\nBest regards\n{tenant}' },
} as const;

type Handler = (deps: JobDeps, tenantId: string, payload: Record<string, unknown>) => Promise<void>;

const HANDLERS: Record<string, Handler> = {
  /** Lead: offer.pdf (customer language), tech.pdf, bom.xlsx → e-mails → webhook. */
  async 'lead.process'(deps, tenantId, payload) {
    const { db, mailer, cfg } = deps;
    const tenant = (await tenantById(db, tenantId))!;
    const lead = await getLead(db, tenantId, String(payload['leadId']));
    if (!lead) throw new Error('lead not found');
    const rev = (await getConfigRevision(db, tenantId, lead.configId, lead.revision))!;
    const locale = lead.locale as Locale;
    const offer = await buildExport(deps, tenant, rev, 'offer.pdf', locale);
    const tech = await buildExport(deps, tenant, rev, 'tech.pdf');
    const xlsx = await buildExport(deps, tenant, rev, 'bom.xlsx');
    const base = { configId: rev.configId, revision: rev.revision };
    const [offerId, techId, xlsxId] = await Promise.all([
      saveFile(db, tenantId, { kind: 'offer_pdf', name: `nabidka-${rev.configId}-${rev.revision}.pdf`, mime: 'application/pdf', data: offer, ...base }),
      saveFile(db, tenantId, { kind: 'tech_pdf', name: `technicky-list-${rev.configId}-${rev.revision}.pdf`, mime: 'application/pdf', data: tech, ...base }),
      saveFile(db, tenantId, { kind: 'bom_xlsx', name: `kusovnik-${rev.configId}-${rev.revision}.xlsx`, mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', data: xlsx, ...base }),
    ]);
    await updateLead(db, tenantId, lead.id, { offerPdfFileId: offerId, techPdfFileId: techId, bomXlsxFileId: xlsxId });
    const link = configLink(cfg, tenant, rev.configId);
    const photo = lead.photoFileId ? await getFile(db, tenantId, lead.photoFileId) : undefined;
    const c = lead.contact;
    await mailer.send({
      to: tenant.settings.notifyEmail,
      replyTo: c.email,
      subject: `Nová poptávka ${lead.id}: ${c.name} (${c.postalCode})`,
      text: [
        `Poptávka ${lead.id} – konfigurace ${rev.configId} rev. ${rev.revision}`,
        `Jméno: ${c.name}`, `E-mail: ${c.email}`, `Telefon: ${c.phone}`, `PSČ: ${c.postalCode}`, `Termín: ${c.term}`, `Rozpočet: ${c.budget}`, `Poznámka: ${c.note}`,
        `Cena (server): ${lead.priceTotal.toLocaleString('cs-CZ')} Kč bez DPH`, `Konfigurace: ${link}`,
      ].join('\n'),
      attachments: [
        { filename: `nabidka-${rev.configId}.pdf`, content: offer, contentType: 'application/pdf' },
        { filename: `technicky-list-${rev.configId}.pdf`, content: tech, contentType: 'application/pdf' },
        { filename: `kusovnik-${rev.configId}.xlsx`, content: xlsx, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
        ...(photo ? [{ filename: photo.name, content: photo.data, contentType: photo.mime }] : []),
      ],
    });
    const m = MAIL[locale] ?? MAIL.cs;
    await mailer.send({
      to: c.email,
      replyTo: tenant.settings.notifyEmail,
      subject: `${m.subjectCustomer} – ${tenant.name}`,
      text: m.bodyCustomer.replace('{link}', link).replace('{tenant}', tenant.name),
      attachments: [{ filename: `nabidka-${rev.configId}.pdf`, content: offer, contentType: 'application/pdf' }],
    });
    await updateLead(db, tenantId, lead.id, { deliveredAt: new Date() });
    if (tenant.settings.webhookUrl) await enqueue(db, tenantId, 'lead.webhook', { leadId: lead.id });
  },

  /** Signed webhook: X-Sauna-Signature: t=<unix>,v1=<hex HMAC-SHA256(secret, "<t>.<body>")>. */
  async 'lead.webhook'(deps, tenantId, payload) {
    const { db, cfg } = deps;
    const tenant = (await tenantById(db, tenantId))!;
    const url = tenant.settings.webhookUrl;
    if (!url) return;
    const lead = (await getLead(db, tenantId, String(payload['leadId'])))!;
    const body = JSON.stringify({
      event: 'lead.created',
      tenant: tenant.slug,
      lead: { id: lead.id, status: lead.status, createdAt: lead.createdAt, contact: lead.contact, locale: lead.locale, priceTotal: lead.priceTotal },
      config: { id: lead.configId, revision: lead.revision, link: configLink(cfg, tenant, lead.configId) },
    });
    const t = Math.floor(Date.now() / 1000);
    const sig = createHmac('sha256', tenant.settings.webhookSecret ?? '').update(`${t}.${body}`).digest('hex');
    const res = await (deps.fetch ?? fetch)(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-sauna-event': 'lead.created', 'x-sauna-signature': `t=${t},v1=${sig}` },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`webhook HTTP ${res.status}`);
  },
};

export function verifyWebhook(secret: string, header: string, body: string, toleranceS = 300): boolean {
  const m = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(header);
  if (!m) return false;
  if (Math.abs(Date.now() / 1000 - Number(m[1])) > toleranceS) return false;
  const expected = createHmac('sha256', secret).update(`${m[1]}.${body}`).digest('hex');
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(m[2]!, 'hex'));
}
