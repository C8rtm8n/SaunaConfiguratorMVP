import { useEffect, useRef } from 'preact/hooks';
import { STEPS, useApp } from '../state.js';
import type { I18nKey } from '../i18n.js';

export function Stepper() {
  const { step, setStep, i18n } = useApp();
  return (
    <ol class="stepper">
      {Array.from({ length: STEPS }, (_, i) => i + 1).map((n) => (
        <li key={n}>
          <button type="button" class={n === step ? 'cur' : n < step ? 'done' : ''} aria-current={n === step ? 'step' : undefined} onClick={() => setStep(n)}>
            <span class="num">{n}</span>
            <span class="lbl">{i18n.t(`step.${n}` as I18nKey)}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

export function PriceBar() {
  const { ev, i18n, tenant, currency, setCurrency, bridge } = useApp();
  const { t } = i18n;
  const r = tenant.catalog.rates;
  const d = ev.price.display;
  const money = (v: number) => i18n.money(v, currency, r.eurPerCzk, r.priceRounding_czk);
  const text = d.mode === 'hidden' ? t('price.hidden') : d.mode === 'range' ? t('price.range', { from: money(d.from), to: money(d.to) }) : money(d.value);
  const errors = ev.violations.filter((v) => v.level === 'error').length;
  const warnings = ev.violations.length - errors;

  // price_change for the host page (debounced; values in the shown currency).
  const timer = useRef<number>();
  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const k = currency === 'EUR' ? r.eurPerCzk : 1;
      bridge.send('price_change', d.mode === 'hidden' ? { mode: 'hidden', currency } : d.mode === 'range' ? { mode: 'range', from: Math.round(d.from * k), to: Math.round(d.to * k), currency } : { mode: 'exact', value: Math.round(d.value * k), currency });
    }, 600);
    return () => clearTimeout(timer.current);
  }, [text]);

  return (
    <div class="pricebar" aria-live="polite">
      <div>
        <div class="muted small">{t('price.label')}</div>
        <div class="price" data-testid="price">
          {text}
        </div>
        {d.mode !== 'hidden' && <div class="muted small">{t('price.exVat')}</div>}
      </div>
      <div class="pb-right">
        <a href="#warnings" class={`badge ${errors ? 'b-err' : warnings ? 'b-warn' : 'b-ok'}`} data-testid="badge">
          {errors || warnings ? t('warn.count', { errors, warnings }) : t('warn.none')}
        </a>
        {tenant.currencies.length > 1 && (
          <select aria-label="currency" name="currency" value={currency} onChange={(e) => setCurrency((e.target as HTMLSelectElement).value as typeof currency)}>
            {tenant.currencies.map((c) => (
              <option value={c} key={c}>
                {c}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}

export function Warnings() {
  const { ev, i18n, applyFix } = useApp();
  const { t, tx, msg } = i18n;
  if (!ev.violations.length && !ev.auto.length) return null;
  return (
    <section class="warnings" id="warnings">
      {ev.violations.length > 0 && <h3>{t('warn.title')}</h3>}
      <ul>
        {ev.violations.map((v, i) => (
          <li key={`${v.ruleId}-${i}`} class={v.level === 'error' ? 'w-err' : 'w-warn'} data-rule={v.ruleId}>
            <span>{msg(v.message, v.params)}</span>
            {v.suggestedFix && (
              <button type="button" class="btn small" onClick={() => applyFix(v.suggestedFix!.patch)}>
                {tx(v.suggestedFix.label)}
              </button>
            )}
          </li>
        ))}
      </ul>
      {ev.auto.length > 0 && (
        <details>
          <summary>
            {t('auto.title')} ({ev.auto.length})
          </summary>
          <ul>
            {ev.auto.map((a, i) => (
              <li key={i} class="w-info">
                {msg(a.note, a.params)}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
