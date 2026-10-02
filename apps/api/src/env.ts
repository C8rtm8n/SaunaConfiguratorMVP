/** Runtime configuration from environment variables (see .env.example). No secrets in the repo. */
export interface ApiConfig {
  port: number;
  host: string;
  /** postgres://… (production) or pglite://memory | pglite://<dir> (tests, local without a server). */
  databaseUrl: string;
  /** Public base URL of this API (links in e-mails). */
  publicUrl: string;
  /** Admin app URL (magic link redirect, CORS with credentials). */
  adminUrl: string;
  /** Configurator URL (links back to a configuration in PDFs). */
  configuratorUrl: string;
  /** smtp://… or "memory" (dev/test outbox). */
  smtpUrl: string;
  mailFrom: string;
  chromiumPath: string;
  production: boolean;
  sessionTtlHours: number;
  magicLinkTtlMinutes: number;
  /** Job worker poll interval. */
  workerIntervalMs: number;
}

export function readEnv(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const production = env['NODE_ENV'] === 'production';
  const req = (k: string, dflt: string) => {
    const v = env[k];
    if (!v && production) throw new Error(`missing env ${k}`);
    return v || dflt;
  };
  return {
    port: Number(env['PORT'] ?? 3000),
    host: env['HOST'] ?? '0.0.0.0',
    databaseUrl: req('DATABASE_URL', 'pglite://./.data/pglite'),
    publicUrl: req('PUBLIC_API_URL', 'http://localhost:3000'),
    adminUrl: req('ADMIN_URL', 'http://localhost:5174'),
    configuratorUrl: req('CONFIGURATOR_URL', 'http://localhost:5173'),
    smtpUrl: req('SMTP_URL', 'memory'),
    mailFrom: env['MAIL_FROM'] ?? 'Konfigurátor <noreply@example.com>',
    chromiumPath: env['CHROMIUM_PATH'] ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    production,
    sessionTtlHours: Number(env['SESSION_TTL_HOURS'] ?? 24 * 7),
    magicLinkTtlMinutes: Number(env['MAGIC_LINK_TTL_MINUTES'] ?? 15),
    workerIntervalMs: Number(env['WORKER_INTERVAL_MS'] ?? 500),
  };
}
