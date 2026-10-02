import type { Locale } from '@sauna/core';

/** Startup parameters from the iframe URL (set by embed.js) or a standalone page. */
export interface Env {
  tenant: string;
  lang?: Locale;
  configId?: string;
  embedded: boolean;
  /** Host page origin for postMessage (only when embedded). */
  hostOrigin?: string;
  /** API base; empty = local demo mode (M3), M4 sets it at build time. */
  apiBase: string;
}

export function readEnv(search = location.search): Env {
  const q = new URLSearchParams(search);
  const lang = q.get('lang');
  const env: Env = {
    tenant: q.get('tenant') ?? 'demo',
    embedded: q.get('embed') === '1' && window.parent !== window,
    apiBase: (import.meta.env['VITE_API_BASE'] as string | undefined) ?? '',
  };
  if (lang === 'cs' || lang === 'de' || lang === 'en') env.lang = lang;
  const c = q.get('c');
  if (c && /^[\w-]{1,64}$/.test(c)) env.configId = c;
  const origin = q.get('origin');
  if (origin && /^https?:\/\/[^/]+$/.test(origin)) env.hostOrigin = origin;
  return env;
}
