import type { TenantPublic } from '../model/tenant.js';
import { toPublicCatalog } from '../catalog/public.js';
import { DEMO_CATALOG } from './demoCatalog.js';

/** Public data of the demo tenant (what GET /tenants/demo/public will return in M4). */
export const DEMO_TENANT: TenantPublic = {
  slug: 'demo',
  name: 'Demo Sauny s.r.o.',
  locales: ['cs', 'de', 'en'],
  defaultLocale: 'cs',
  currencies: ['CZK', 'EUR'],
  defaultCurrency: 'CZK',
  theme: {
    primary: '#9a4f2a',
    primaryText: '#ffffff',
    background: '#f6f3ef',
    surface: '#ffffff',
    text: '#1f1b17',
    muted: '#6f665d',
    danger: '#b3261e',
    warning: '#8a5a00',
    radius_px: 10,
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  },
  catalog: toPublicCatalog(DEMO_CATALOG),
  embedOrigins: [],
};
