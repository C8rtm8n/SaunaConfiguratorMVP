import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import '@fastify/cookie';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Db } from './db/index.js';
import { magicLinks, sessions, users } from './db/schema.js';

/**
 * Admin auth (D-045): e-mail + magic link → httpOnly session cookie.
 * Tokens are random 32 bytes; only SHA-256 hashes are stored. Links are single-use.
 */
export const SESSION_COOKIE = 'sauna_sid';
const hash = (t: string) => createHash('sha256').update(t).digest('hex');
const token = () => randomBytes(32).toString('base64url');

export interface AuthUser {
  id: string;
  tenantId: string;
  email: string;
  role: 'admin' | 'sales';
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

/** Returns the raw token for the e-mail, or null when no active user matches (caller answers 204 either way). */
export async function createMagicLink(db: Db, tenantId: string, email: string, ttlMinutes: number): Promise<string | null> {
  const u = (await db.select().from(users).where(and(eq(users.tenantId, tenantId), sql`lower(${users.email}) = ${email.toLowerCase()}`, eq(users.active, true))).limit(1))[0];
  if (!u) return null;
  const t = token();
  await db.insert(magicLinks).values({ tokenHash: hash(t), userId: u.id, expiresAt: new Date(Date.now() + ttlMinutes * 60_000) });
  return t;
}

/** Consumes a magic link and creates a session; returns the session token or null. */
export async function consumeMagicLink(db: Db, raw: string, sessionTtlHours: number): Promise<string | null> {
  const used = await db
    .update(magicLinks)
    .set({ usedAt: new Date() })
    .where(and(eq(magicLinks.tokenHash, hash(raw)), isNull(magicLinks.usedAt), gt(magicLinks.expiresAt, new Date())))
    .returning({ userId: magicLinks.userId });
  const userId = used[0]?.userId;
  if (!userId) return null;
  const s = token();
  await db.insert(sessions).values({ tokenHash: hash(s), userId, expiresAt: new Date(Date.now() + sessionTtlHours * 3_600_000) });
  return s;
}

export async function userForSession(db: Db, raw: string | undefined): Promise<AuthUser | undefined> {
  if (!raw) return undefined;
  const r = await db
    .select({ id: users.id, tenantId: users.tenantId, email: users.email, role: users.role })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, hash(raw)), gt(sessions.expiresAt, new Date()), eq(users.active, true)))
    .limit(1);
  return r[0];
}

export async function destroySession(db: Db, raw: string | undefined): Promise<void> {
  if (raw) await db.delete(sessions).where(eq(sessions.tokenHash, hash(raw)));
}

export function requireUser(db: Db, roles: Array<AuthUser['role']> = ['admin', 'sales']) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const u = await userForSession(db, req.cookies[SESSION_COOKIE]);
    if (!u) return reply.code(401).send({ error: 'unauthorized' });
    if (!roles.includes(u.role)) return reply.code(403).send({ error: 'forbidden' });
    req.user = u;
  };
}
