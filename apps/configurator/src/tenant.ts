import type { TenantPublic, TenantTheme } from '@sauna/core';

/** GET /tenants/:slug/public (M4); without an API the demo tenant is bundled lazily. */
export async function loadTenant(slug: string, apiBase: string): Promise<TenantPublic> {
  if (apiBase) {
    const r = await fetch(`${apiBase}/tenants/${encodeURIComponent(slug)}/public`, { credentials: 'omit' });
    if (!r.ok) throw new Error(`tenant ${slug}: HTTP ${r.status}`);
    return (await r.json()) as TenantPublic;
  }
  const { DEMO_TENANT } = await import('@sauna/core/fixtures');
  return DEMO_TENANT;
}

/** Theme → CSS custom properties on :root. */
export function applyTheme(t: TenantTheme): void {
  const s = document.documentElement.style;
  s.setProperty('--c-primary', t.primary);
  s.setProperty('--c-on-primary', t.primaryText);
  s.setProperty('--c-bg', t.background);
  s.setProperty('--c-surface', t.surface);
  s.setProperty('--c-text', t.text);
  s.setProperty('--c-muted', t.muted);
  s.setProperty('--c-danger', t.danger);
  s.setProperty('--c-warning', t.warning);
  s.setProperty('--radius', `${t.radius_px}px`);
  s.setProperty('--font', t.fontFamily);
  if (t.fontCss && !document.querySelector(`link[href="${t.fontCss}"]`)) {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = t.fontCss;
    document.head.appendChild(l);
  }
}
