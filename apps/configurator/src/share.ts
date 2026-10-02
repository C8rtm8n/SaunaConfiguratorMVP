import type { App } from './state.js';

/** Share link: back to the manufacturer's page when embedded (?c=<id>), else this app. */
export function shareUrl(app: Pick<App, 'bridge' | 'env'>, id: string): string {
  const base = app.bridge.hostHref ?? location.href;
  const u = new URL(base);
  u.searchParams.set('c', id);
  if (!app.bridge.hostHref) u.searchParams.set('tenant', app.env.tenant);
  u.searchParams.delete('embed');
  u.searchParams.delete('origin');
  return u.toString();
}
