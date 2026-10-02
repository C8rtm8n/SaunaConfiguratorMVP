import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from './schema.js';

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
export { schema };

const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), '../../drizzle');

/** Opens the database and applies migrations (same SQL for PostgreSQL and PGlite). */
export async function openDb(url: string): Promise<{ db: Db; close: () => Promise<void>; driver: 'pg' | 'pglite' }> {
  if (url.startsWith('pglite://')) {
    const { PGlite } = await import('@electric-sql/pglite');
    const { drizzle } = await import('drizzle-orm/pglite');
    const { migrate } = await import('drizzle-orm/pglite/migrator');
    const where = url.slice('pglite://'.length);
    const client = where === 'memory' ? new PGlite() : new PGlite(where);
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder });
    return { db: db as unknown as Db, close: () => client.close(), driver: 'pglite' };
  }
  const { default: pg } = await import('pg');
  const { drizzle } = await import('drizzle-orm/node-postgres');
  const { migrate } = await import('drizzle-orm/node-postgres/migrator');
  const pool = new pg.Pool({ connectionString: url, max: 10 });
  const db = drizzle(pool, { schema });
  await migrate(db, { migrationsFolder });
  return { db: db as unknown as Db, close: () => pool.end(), driver: 'pg' };
}

/** Rows of a raw `db.execute()` result for both drivers. */
export function rows<T>(r: unknown): T[] {
  return ((r as { rows?: T[] }).rows ?? (r as T[])) as T[];
}
