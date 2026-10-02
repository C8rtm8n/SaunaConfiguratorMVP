import { useState } from 'preact/hooks';
import { useApp } from '../state.js';
import { Section } from '../components/ui.js';
import type { Contact } from '../repo.js';
import type { I18nKey } from '../i18n.js';
import { shareUrl } from '../share.js';
import { takeSnapshots } from '../snapshots.js';

/** Upload limit for the site photo (UI/transport limit, not a domain value). */
const PHOTO_MAX_MB = 10;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function Step8Summary() {
  const app = useApp();
  const { config, ev, i18n, tenant, repos, bridge, currency } = app;
  const { t, tx, m } = i18n;
  const cat = tenant.catalog;
  const name = (list: Array<{ sku: string; name: Parameters<typeof tx>[0] }>, sku: string) => {
    const x = list.find((i) => i.sku === sku);
    return x ? tx(x.name) : sku;
  };
  const [c, setC] = useState<Contact>({ name: '', email: '', phone: '', postalCode: '', term: '', budget: '', note: '', consent: false });
  const [photo, setPhoto] = useState<File | undefined>();
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [msg, setMsg] = useState('');
  const [touched, setTouched] = useState(false);
  const errors = ev.violations.filter((v) => v.level === 'error');
  const formOk = c.name.trim().length > 1 && EMAIL.test(c.email.trim()) && /^[\d\s-]{3,10}$/.test(c.postalCode.trim()) && c.consent;
  const canSubmit = ev.submittable && formOk && state !== 'sending' && state !== 'sent';

  const field = (k: keyof Contact, label: string, opts: { type?: string; required?: boolean; area?: boolean } = {}) => (
    <label class={`field${touched && opts.required && !String(c[k]).trim() ? ' invalid' : ''}`}>
      <span>
        {label}
        {opts.required && ' *'}
      </span>
      {opts.area ? (
        <textarea name={k} rows={3} value={String(c[k])} onInput={(e) => setC({ ...c, [k]: (e.target as HTMLTextAreaElement).value })} />
      ) : (
        <input name={k} type={opts.type ?? 'text'} required={opts.required} value={String(c[k])} onInput={(e) => setC({ ...c, [k]: (e.target as HTMLInputElement).value })} />
      )}
    </label>
  );

  const submit = async (e: Event) => {
    e.preventDefault();
    setTouched(true);
    if (!ev.submittable) return setMsg(t('form.blocked'));
    if (!formOk) return setMsg(t('form.invalid'));
    setState('sending');
    try {
      const snapshots = await takeSnapshots();
      const r = await repos.submitLead({ tenant: tenant.slug, config, contact: c, ...(photo ? { photo } : {}), locale: i18n.locale, clientPrice: Math.round(ev.price.total), snapshots });
      setState('sent');
      setMsg(t('form.sent', { id: r.leadId }));
      bridge.send('lead_submitted', { leadId: r.leadId, configId: r.configId, currency, ...(cat.rates.priceDisplay !== 'hidden' ? { value: Math.round(ev.price.total) } : {}) });
    } catch {
      setState('error');
      setMsg(t('form.error'));
    }
  };

  const extras = config.attachments.map((a) => name(cat.attachmentSystems, a.sku)).join(', ') || '–';
  return (
    <>
      <Section title={t('sum.title')}>
        <dl class="summary">
          <dt>{t('sum.module')}</dt>
          <dd>
            {t(config.module.type === 'iso_20hc' ? 'module.iso' : 'module.custom')}, {m(config.module.L_mm, 2)} × {m(config.module.W_mm, 2)} × {m(config.module.H_mm, 2)} m
          </dd>
          <dt>{t('sum.layout')}</dt>
          <dd>{config.zones.map((z) => t(z.type === 'sauna' ? 'layout.sauna' : 'layout.changing', { l: m(z.to_mm - z.from_mm, 1) })).join(' · ')}</dd>
          <dt>{t('sum.openings')}</dt>
          <dd>{config.openings.map((o) => `${name(cat.openings, o.sku)} (${t(`wall.${o.wall}` as I18nKey)})`).join(', ') || '–'}</dd>
          <dt>{t('sum.exterior')}</dt>
          <dd>
            {name(cat.panels, config.cladding.exterior)}, {name(cat.panels, config.cladding.roof)}
          </dd>
          <dt>{t('sum.interior')}</dt>
          <dd>
            {name(cat.panels, config.sauna.interiorCladding)}, {name(cat.heaters, config.sauna.heater.sku)}, {t('int.benches')} {t(config.sauna.benches.layout === 'L' ? 'int.L' : 'int.straight')} / {config.sauna.benches.levels}
          </dd>
          <dt>{t('sum.extras')}</dt>
          <dd>{extras}</dd>
          <dt>{t('sum.foundation')}</dt>
          <dd>{name(cat.foundations, cat.foundations.find((f) => f.type === config.foundation)?.sku ?? '')}</dd>
          <dt>{t('sum.transport')}</dt>
          <dd>{t(ev.transport.oversize ? 'sum.transport.oversize' : 'sum.transport.normal')}</dd>
        </dl>
        <ShareButton />
      </Section>
      <Section title={t('form.title')}>
        {state === 'sent' ? (
          <p class="ok" role="status">
            {msg}
          </p>
        ) : (
          <form class="form" onSubmit={submit} noValidate>
            {field('name', t('form.name'), { required: true })}
            {field('email', t('form.email'), { type: 'email', required: true })}
            {field('phone', t('form.phone'), { type: 'tel' })}
            {field('postalCode', t('form.postalCode'), { required: true })}
            {field('term', t('form.term'))}
            {field('budget', t('form.budget'))}
            {field('note', t('form.note'), { area: true })}
            <label class="field">
              <span>{t('form.photo')}</span>
              <input
                type="file"
                name="photo"
                accept="image/*"
                onChange={(e) => {
                  const f = (e.target as HTMLInputElement).files?.[0];
                  if (f && f.size > PHOTO_MAX_MB * 1024 * 1024) {
                    setMsg(t('form.photo.tooBig', { mb: PHOTO_MAX_MB }));
                    (e.target as HTMLInputElement).value = '';
                    return setPhoto(undefined);
                  }
                  setPhoto(f);
                }}
              />
            </label>
            <label class={`check${touched && !c.consent ? ' invalid' : ''}`}>
              <input type="checkbox" name="consent" checked={c.consent} onChange={(e) => setC({ ...c, consent: (e.target as HTMLInputElement).checked })} />
              <span>{t('form.consent')} *</span>
            </label>
            {errors.length > 0 && <p class="err">{t('form.blocked')}</p>}
            {msg && state !== 'sending' && <p class={state === 'error' ? 'err' : 'muted'}>{msg}</p>}
            <button class="btn primary" type="submit" disabled={!canSubmit} aria-disabled={!canSubmit}>
              {t('form.submit')}
            </button>
          </form>
        )}
      </Section>
    </>
  );
}

function ShareButton() {
  const app = useApp();
  const { t } = app.i18n;
  const [link, setLink] = useState('');
  const save = async () => {
    const saved = await app.repos.saveConfig(app.config);
    app.setConfig(saved.config);
    const url = shareUrl(app, saved.id);
    setLink(url);
    app.bridge.send('config_saved', { id: saved.id, shareUrl: url });
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* clipboard not allowed → link stays visible */
    }
  };
  return (
    <div class="share">
      <button type="button" class="btn ghost" onClick={save}>
        {t('share.save')}
      </button>
      {link && (
        <label class="field">
          <span>{t('share.link')}</span>
          <input readOnly value={link} onFocus={(e) => (e.target as HTMLInputElement).select()} name="shareLink" />
        </label>
      )}
    </div>
  );
}
