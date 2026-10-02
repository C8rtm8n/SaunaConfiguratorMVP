import { Fragment } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { Violation } from '@sauna/core';
import { api, exportUrl, fileUrl } from '../api.js';
import { STATUS, czk, date, num } from '../format.js';

interface Detail {
  lead: { id: string; configId: string; revision: number; status: string; locale: string; contact: Record<string, string>; createdAt: string; deliveredAt: string | null };
  revision: { revision: number; catalogVersion: string; summary: { priceTotal: number; priceCost: number; emptyMass_kg: number; errors: number; warnings: number }; createdAt: string };
  revisions: Array<{ revision: number; createdAt: string }>;
  evaluation: {
    price: { total: number; cost: number };
    config: { module: { type: string; L_mm: number; W_mm: number; H_mm: number }; openings: unknown[]; zones: Array<{ type: string; from_mm: number; to_mm: number }> };
    sauna: { eqVolume_m3: number; suitableHeaters: string[]; electrical?: { power_kw: number; breaker_A: number; cable: string } };
    mass: { empty_kg: number; transport_kg: number };
    transport: { oversize: boolean };
    violations: Violation[];
  };
  files: Array<{ id: string; kind: string; name: string; size: number }>;
  snapshots: Array<{ id: string; view: string }>;
  link: string;
}

const LABELS: Record<string, string> = { name: 'Jméno', email: 'E-mail', phone: 'Telefon', postalCode: 'PSČ', term: 'Termín', budget: 'Rozpočet', note: 'Poznámka' };

export function LeadDetail(p: { id: string }) {
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    api<Detail>(`/admin/leads/${p.id}/detail`).then(setD, () => setErr('Poptávka nenalezena.'));
  }, [p.id]);
  if (err) return <p class="err">{err}</p>;
  if (!d) return <p class="muted">Načítám…</p>;
  const { lead, evaluation: ev } = d;
  const margin = ev.price.total - ev.price.cost;
  return (
    <section class="detail">
      <p>
        <a href="#/leads">← Poptávky</a>
      </p>
      <h2>
        Poptávka {lead.id} · {STATUS[lead.status]}
      </h2>
      <div class="cols">
        <div class="card">
          <h3>Zákazník</h3>
          <dl>
            {Object.entries(LABELS).map(([k, label]) => (
              <Fragment key={k}>
                <dt>{label}</dt>
                <dd>{k === 'email' ? <a href={`mailto:${lead.contact[k]}`}>{lead.contact[k]}</a> : lead.contact[k] || '–'}</dd>
              </Fragment>
            ))}
            <dt>Jazyk</dt>
            <dd>{lead.locale}</dd>
            <dt>Přijato</dt>
            <dd>{date(lead.createdAt)}</dd>
          </dl>
        </div>
        <div class="card">
          <h3>Konfigurace {lead.configId} · rev. {lead.revision}</h3>
          <dl>
            <dt>Modul</dt>
            <dd>
              {ev.config.module.type} {num(ev.config.module.L_mm / 1000, 2)} × {num(ev.config.module.W_mm / 1000, 2)} × {num(ev.config.module.H_mm / 1000, 2)} m
            </dd>
            <dt>Zóny</dt>
            <dd>{ev.config.zones.map((z) => `${z.type} ${num((z.to_mm - z.from_mm) / 1000, 1)} m`).join(' · ')}</dd>
            <dt>Cena / náklad</dt>
            <dd>
              {czk(ev.price.total)} / {czk(ev.price.cost)} (marže {czk(margin)})
            </dd>
            <dt>Hmotnost</dt>
            <dd>
              {num(ev.mass.empty_kg, 0)} kg (přeprava {num(ev.mass.transport_kg, 0)} kg){ev.transport.oversize ? ' · nadrozměr' : ''}
            </dd>
            <dt>Objem sauny</dt>
            <dd>{num(ev.sauna.eqVolume_m3, 1)} m³ (ekviv.)</dd>
            {ev.sauna.electrical && (
              <>
                <dt>Elektro</dt>
                <dd>
                  {ev.sauna.electrical.power_kw} kW, jistič {ev.sauna.electrical.breaker_A} A, {ev.sauna.electrical.cable}
                </dd>
              </>
            )}
            <dt>Katalog</dt>
            <dd>{d.revision.catalogVersion}</dd>
          </dl>
          <p>
            <a href={d.link} target="_blank" rel="noopener">
              Otevřít v konfigurátoru ↗
            </a>
          </p>
        </div>
      </div>
      <div class="card">
        <h3>Exporty (rev. {lead.revision})</h3>
        <div class="downloads">
          {['offer.pdf', 'tech.pdf', 'bom.xlsx', 'bom.csv', 'config.json'].map((n) => (
            <a class="btn small" href={exportUrl(lead.configId, n, lead.revision)} key={n} data-export={n}>
              {n}
            </a>
          ))}
          {d.files
            .filter((f) => f.kind === 'photo')
            .map((f) => (
              <a class="btn small" href={fileUrl(f.id)} key={f.id}>
                foto místa
              </a>
            ))}
        </div>
      </div>
      {d.snapshots.length > 0 && (
        <div class="card">
          <h3>Vizualizace od zákazníka</h3>
          <div class="thumbs">
            {d.snapshots.map((s) => (
              <img key={s.id} src={fileUrl(s.id)} alt={s.view} loading="lazy" />
            ))}
          </div>
        </div>
      )}
      {ev.violations.length > 0 && (
        <div class="card">
          <h3>Upozornění</h3>
          <ul>
            {ev.violations.map((v, i) => (
              <li key={i}>
                {v.ruleId}: {v.message.cs.replace(/\{([^}]+)\}/g, (_, k: string) => String(v.params[k] ?? ''))}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div class="card">
        <h3>Revize</h3>
        <ul>
          {d.revisions.map((r) => (
            <li key={r.revision}>
              rev. {r.revision} · {date(r.createdAt)} · <a href={exportUrl(lead.configId, 'offer.pdf', r.revision)}>offer.pdf</a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
