import { useEffect, useMemo, useState } from 'preact/hooks';
import type { Catalog, PriceCategory } from '@sauna/core';
import { api } from '../api.js';
import { Publish } from '../components/Publish.js';
import { setPath, getPath } from '../catalogSpec.js';

const MARGINS: Array<[PriceCategory, string]> = [['steel', 'Ocel'], ['timber', 'Dřevo a plášť'], ['purchased', 'Nakupované díly'], ['labour', 'Práce'], ['transport', 'Doprava'], ['crane', 'Jeřáb']];

/** Rates live in the catalog (versioned with it). */
export function RatesPage(p: { readOnly: boolean }) {
  const [base, setBase] = useState<Catalog | null>(null);
  const [draft, setDraft] = useState<Catalog | null>(null);
  const load = () => api<Catalog>('/admin/catalog').then((c) => (setBase(c), setDraft(JSON.parse(JSON.stringify(c)) as Catalog)));
  useEffect(() => void load(), []);
  const dirty = useMemo(() => !!base && JSON.stringify(base) !== JSON.stringify(draft), [base, draft]);
  if (!draft) return <p class="muted">Načítám…</p>;
  const set = (path: string, v: unknown) => {
    const d = JSON.parse(JSON.stringify(draft)) as Catalog;
    setPath(d as unknown as Record<string, unknown>, path, v);
    setDraft(d);
  };
  const numField = (path: string, label: string, unit: string, scale = 1) => (
    <label class="field" key={path}>
      <span>
        {label} <i class="muted">[{unit}]</i>
      </span>
      <input name={path} type="number" step="any" disabled={p.readOnly} value={Number(getPath(draft, path)) * scale} onChange={(e) => set(path, Number((e.target as HTMLInputElement).value) / scale)} />
    </label>
  );
  return (
    <section>
      <h2>Sazby a zobrazení ceny · katalog {draft.version}</h2>
      <div class="cols">
        <div class="card form">
          <h3>Práce a doprava</h3>
          {numField('rates.labour_per_h', 'Hodinová sazba práce', 'Kč/h')}
          {numField('rates.transport.per_km', 'Doprava', 'Kč/km')}
          {numField('rates.transport.flat', 'Doprava paušál', 'Kč')}
          {numField('rates.transport.defaultDistance_km', 'Výchozí vzdálenost', 'km')}
          {numField('rates.transport.oversizeSurcharge', 'Příplatek nadrozměr', 'Kč')}
          {numField('rates.crane.flat', 'Autojeřáb paušál', 'Kč')}
          {numField('rates.crane.per_h', 'Autojeřáb', 'Kč/h')}
          {numField('rates.crane.defaultHours', 'Autojeřáb hodin', 'h')}
        </div>
        <div class="card form">
          <h3>Marže</h3>
          {MARGINS.map(([k, label]) => numField(`rates.margin.${k}`, label, '%', 100))}
          <h3>Zobrazení ceny zákazníkovi</h3>
          <label class="field">
            <span>Režim</span>
            <select name="priceDisplay" disabled={p.readOnly} value={draft.rates.priceDisplay} onChange={(e) => set('rates.priceDisplay', (e.target as HTMLSelectElement).value)}>
              <option value="hidden">skrytá (cena na dotaz)</option>
              <option value="range">rozpětí</option>
              <option value="exact">přesná</option>
            </select>
          </label>
          {numField('rates.priceRange', 'Šíře rozpětí ±', '%', 100)}
          {numField('rates.priceRounding_czk', 'Zaokrouhlení', 'Kč')}
          {numField('rates.eurPerCzk', 'Kurz EUR za 1 Kč', 'EUR/Kč')}
        </div>
      </div>
      <Publish draft={draft} dirty={dirty} readOnly={p.readOnly} onPublished={() => void load()} />
    </section>
  );
}
