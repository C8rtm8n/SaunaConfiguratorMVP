import { useEffect, useState } from 'preact/hooks';
import type { Locale, TenantTheme } from '@sauna/core';
import { ApiError, api } from '../api.js';

interface Settings {
  locales: Locale[];
  defaultLocale: Locale;
  currencies: Array<'CZK' | 'EUR'>;
  defaultCurrency: 'CZK' | 'EUR';
  theme: TenantTheme;
  embedOrigins: string[];
  notifyEmail: string;
  webhookUrl?: string;
  publicUrl?: string;
  hasWebhookSecret: boolean;
}
interface TenantInfo {
  slug: string;
  name: string;
  settings: Settings;
}

const COLORS: Array<[keyof TenantTheme, string]> = [['primary', 'Hlavní barva'], ['primaryText', 'Text na hlavní barvě'], ['background', 'Pozadí'], ['surface', 'Plochy'], ['text', 'Text'], ['muted', 'Doplňkový text'], ['danger', 'Chyba'], ['warning', 'Upozornění']];

export function SettingsPage(p: { readOnly: boolean }) {
  const [t, setT] = useState<TenantInfo | null>(null);
  const [secret, setSecret] = useState('');
  const [origins, setOrigins] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => {
    api<TenantInfo>('/admin/tenant').then((x) => {
      setT(x);
      setOrigins(x.settings.embedOrigins.join('\n'));
    });
  }, []);
  if (!t) return <p class="muted">Načítám…</p>;
  const s = t.settings;
  const upd = (patch: Partial<Settings>) => setT({ ...t, settings: { ...s, ...patch } });
  const theme = (patch: Partial<TenantTheme>) => upd({ theme: { ...s.theme, ...patch } });
  const toggle = <V extends string>(list: V[], v: V) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const save = async () => {
    setMsg('');
    try {
      await api('/admin/tenant', {
        method: 'PATCH',
        json: {
          name: t.name,
          theme: s.theme,
          locales: s.locales,
          defaultLocale: s.defaultLocale,
          currencies: s.currencies,
          defaultCurrency: s.defaultCurrency,
          embedOrigins: origins.split('\n').map((x) => x.trim()).filter(Boolean),
          notifyEmail: s.notifyEmail,
          webhookUrl: s.webhookUrl ?? '',
          publicUrl: s.publicUrl ?? '',
          ...(secret ? { webhookSecret: secret } : {}),
        },
      });
      setMsg('Uloženo. Konfigurátor nové nastavení použije do minuty.');
      setSecret('');
    } catch (e) {
      const b = e instanceof ApiError ? (e.body as { error?: string; issues?: Array<{ path: string; message: string }> }) : undefined;
      setMsg(`Chyba: ${b?.issues?.map((i) => `${i.path}: ${i.message}`).join('; ') ?? b?.error ?? 'uložení selhalo'}`);
    }
  };
  const logo = (f: File | undefined) => {
    if (!f) return;
    if (f.size > 250_000) return setMsg('Logo může mít nejvýš 250 kB.');
    const r = new FileReader();
    r.onload = () => theme({ logoUrl: String(r.result) });
    r.readAsDataURL(f);
  };
  const snippet = `<script src="https://cdn.example.com/embed.js" data-tenant="${t.slug}" data-lang="${s.defaultLocale}" async></script>\n<div data-sauna-configurator></div>`;
  return (
    <section>
      <h2>Nastavení výrobce</h2>
      <fieldset disabled={p.readOnly} class="cols">
        <div class="card form">
          <h3>Vzhled (white-label)</h3>
          <label class="field">
            <span>Název</span>
            <input name="name" value={t.name} onInput={(e) => setT({ ...t, name: (e.target as HTMLInputElement).value })} />
          </label>
          <div class="colors">
            {COLORS.map(([k, label]) => (
              <label class="color" key={k}>
                <input type="color" name={`theme.${k}`} value={String(s.theme[k])} onInput={(e) => theme({ [k]: (e.target as HTMLInputElement).value })} />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <label class="field">
            <span>Zaoblení rohů [px]</span>
            <input type="number" name="theme.radius_px" min={0} max={40} value={s.theme.radius_px} onInput={(e) => theme({ radius_px: Number((e.target as HTMLInputElement).value) })} />
          </label>
          <label class="field">
            <span>Písmo (CSS font-family)</span>
            <input name="theme.fontFamily" value={s.theme.fontFamily} onInput={(e) => theme({ fontFamily: (e.target as HTMLInputElement).value })} />
          </label>
          <label class="field">
            <span>Logo (PNG/SVG/WebP, max. 250 kB)</span>
            <input type="file" name="logo" accept="image/png,image/svg+xml,image/webp,image/jpeg" onChange={(e) => logo((e.target as HTMLInputElement).files?.[0])} />
          </label>
          <div class="preview" style={{ background: s.theme.background, color: s.theme.text, fontFamily: s.theme.fontFamily, borderRadius: `${s.theme.radius_px}px` }}>
            {s.theme.logoUrl ? <img src={s.theme.logoUrl} alt="" /> : <b>{t.name}</b>}
            <div style={{ background: s.theme.surface, borderRadius: `${s.theme.radius_px}px`, padding: '8px' }}>
              <span style={{ color: s.theme.muted }}>Orientační cena</span>
              <div style={{ fontWeight: 700 }}>298 000 Kč – 364 000 Kč</div>
              <button type="button" style={{ background: s.theme.primary, color: s.theme.primaryText, border: 0, borderRadius: `${s.theme.radius_px}px`, padding: '6px 12px' }}>
                Pokračovat
              </button>
            </div>
          </div>
        </div>
        <div class="card form">
          <h3>Jazyky a měny</h3>
          <div class="row">
            {(['cs', 'de', 'en'] as const).map((l) => (
              <label class="check" key={l}>
                <input type="checkbox" name={`locale-${l}`} checked={s.locales.includes(l)} onChange={() => upd({ locales: toggle(s.locales, l) })} /> {l}
              </label>
            ))}
            <select name="defaultLocale" value={s.defaultLocale} onChange={(e) => upd({ defaultLocale: (e.target as HTMLSelectElement).value as Locale })}>
              {s.locales.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </div>
          <div class="row">
            {(['CZK', 'EUR'] as const).map((c) => (
              <label class="check" key={c}>
                <input type="checkbox" name={`currency-${c}`} checked={s.currencies.includes(c)} onChange={() => upd({ currencies: toggle(s.currencies, c) })} /> {c}
              </label>
            ))}
            <select name="defaultCurrency" value={s.defaultCurrency} onChange={(e) => upd({ defaultCurrency: (e.target as HTMLSelectElement).value as 'CZK' | 'EUR' })}>
              {s.currencies.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <h3>Poptávky</h3>
          <label class="field">
            <span>E-mail pro poptávky</span>
            <input name="notifyEmail" type="email" value={s.notifyEmail} onInput={(e) => upd({ notifyEmail: (e.target as HTMLInputElement).value })} />
          </label>
          <label class="field">
            <span>Webhook URL (nepovinné)</span>
            <input name="webhookUrl" type="url" value={s.webhookUrl ?? ''} onInput={(e) => upd({ webhookUrl: (e.target as HTMLInputElement).value })} />
          </label>
          <label class="field">
            <span>Webhook secret {s.hasWebhookSecret && <i class="muted">(nastaveno – prázdné pole = beze změny)</i>}</span>
            <input name="webhookSecret" type="password" autoComplete="new-password" value={secret} onInput={(e) => setSecret((e.target as HTMLInputElement).value)} />
          </label>
          <label class="field">
            <span>URL stránky s konfigurátorem (odkazy v PDF a e-mailech)</span>
            <input name="publicUrl" type="url" value={s.publicUrl ?? ''} onInput={(e) => upd({ publicUrl: (e.target as HTMLInputElement).value })} />
          </label>
          <label class="field">
            <span>Povolené weby pro vložení (origin na řádek, prázdné = všechny)</span>
            <textarea name="embedOrigins" rows={3} value={origins} onInput={(e) => setOrigins((e.target as HTMLTextAreaElement).value)} />
          </label>
          <h3>Vložení na web</h3>
          <pre class="snippet">{snippet}</pre>
        </div>
      </fieldset>
      {!p.readOnly && (
        <button type="button" class="btn primary" onClick={save}>
          Uložit nastavení
        </button>
      )}
      {msg && <p class={msg.startsWith('Chyba') ? 'err' : 'ok'}>{msg}</p>}
    </section>
  );
}
