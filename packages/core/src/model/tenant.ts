import type { PublicCatalog } from './catalog.js';
import type { Locale } from './i18n.js';

export type Currency = 'CZK' | 'EUR';

/** White-label theming (CSS custom properties in the configurator). */
export interface TenantTheme {
  primary: string;
  primaryText: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
  danger: string;
  warning: string;
  radius_px: number;
  fontFamily: string;
  /** Optional web font stylesheet (Google Fonts URL). */
  fontCss?: string;
  logoUrl?: string;
  /** Static image shown by the embed before the iframe loads. */
  posterUrl?: string;
}

/** GET /tenants/:slug/public – everything the browser needs, no costs (D-035). */
export interface TenantPublic {
  slug: string;
  name: string;
  locales: Locale[];
  defaultLocale: Locale;
  currencies: Currency[];
  defaultCurrency: Currency;
  theme: TenantTheme;
  catalog: PublicCatalog;
  /** Origins allowed to embed the configurator (empty = any). */
  embedOrigins: string[];
}
