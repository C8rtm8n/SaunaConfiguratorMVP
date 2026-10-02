import { render } from 'preact';
import { defaultConfig, type Locale, type SaunaConfig } from '@sauna/core';
import { App } from './app.js';
import { Bridge } from './bridge.js';
import { readEnv } from './env.js';
import { createI18n } from './i18n.js';
import { httpRepos, localRepos } from './repo.js';
import { applyTheme, loadTenant } from './tenant.js';
import './styles.css';

async function boot() {
  const env = readEnv();
  const root = document.getElementById('app')!;
  const bridge = new Bridge(env.embedded ? env.hostOrigin : undefined);
  try {
    const tenant = await loadTenant(env.tenant, env.apiBase);
    // Allowed host pages (D-055): the real parent origin, not the ?origin= parameter.
    if (window.parent !== window && tenant.embedOrigins.length > 0) {
      const anc = (location as Location & { ancestorOrigins?: DOMStringList }).ancestorOrigins;
      const parent = anc?.length ? anc[0]! : document.referrer ? new URL(document.referrer).origin : '';
      if (!tenant.embedOrigins.includes(parent)) {
        root.textContent = 'Konfigurátor není na této stránce povolen.';
        return;
      }
    }
    applyTheme(tenant.theme);
    const nav = (navigator.language || '').slice(0, 2) as Locale;
    const locale: Locale = env.lang && tenant.locales.includes(env.lang) ? env.lang : tenant.locales.includes(nav) ? nav : tenant.defaultLocale;
    document.documentElement.lang = locale;
    const i18n = createI18n(locale);
    document.title = `${i18n.t('app.title')} – ${tenant.name}`;
    const repos = env.apiBase ? httpRepos(env.apiBase, tenant.slug) : localRepos();
    let initial: SaunaConfig = defaultConfig(tenant.catalog);
    let notice: string | undefined;
    if (env.configId) {
      const loaded = await repos.loadConfig(env.configId).catch(() => null);
      if (loaded && loaded.tenantId === tenant.catalog.tenantId) initial = loaded;
      else notice = i18n.t('load.error');
    }
    render(<App base={{ env, tenant, i18n, repos, bridge }} initial={initial} {...(notice ? { notice } : {})} />, root);
    requestAnimationFrame(() => bridge.start());
    Object.assign(window, { __ready: true });
  } catch (e) {
    root.textContent = `Konfigurátor se nepodařilo načíst. (${(e as Error).message})`;
  }
}
boot();
