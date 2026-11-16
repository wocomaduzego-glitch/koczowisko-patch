import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { and, eq, gt, lt } from "drizzle-orm";

export const COOKIE = "koc_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 180;
const expiresAt = () => new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
const digest = (token: string) => createHash("sha256").update(token).digest("hex");

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `s2:${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    if (password.length > 256) return false;
    const [version, salt, hash] = stored.split(":");
    if (version !== "s2" || !salt || !hash) return false;
    const expected = Buffer.from(hash, "hex");
    const actual = scryptSync(password, salt, 64);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch { return false; }
}

// Only a SHA-256 hash is stored in the database. A database leak does not expose usable tokens.
export async function makeToken(userId: string): Promise<string> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  const token = randomBytes(32).toString("hex");
  await db.insert(sessions).values({ tokenHash: digest(token), userId, expiresAt: expiresAt() });
  return token;
}

export async function requestToken(): Promise<string | null> {
  const authorization = (await headers()).get("authorization");
  // An explicit invalid Bearer must not fall back to a different cookie identity.
  if (authorization?.startsWith("Bearer ")) return authorization.slice(7).trim();
  return (await cookies()).get(COOKIE)?.value ?? null;
}

export async function currentSession() {
  const token = await requestToken();
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const row = (await db.select({ user: users, session: sessions }).from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, digest(token)), gt(sessions.expiresAt, new Date())))
    .limit(1))[0];
  return row ? { ...row, token } : null;
}

export async function currentUserId(): Promise<string | null> {
  return (await currentSession())?.user.id ?? null;
}

export async function renewSession(token: string) {
  await db.update(sessions).set({ expiresAt: expiresAt() }).where(eq(sessions.tokenHash, digest(token)));
}

export async function revokeSession() {
  const token = await requestToken();
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, digest(token)));
  // Also clear a cookie session if a client sent a different Bearer token.
  const cookie = (await cookies()).get(COOKIE)?.value;
  if (cookie && cookie !== token) await db.delete(sessions).where(eq(sessions.tokenHash, digest(cookie)));
}

export function userCookieOptions(req?: Request) {
  const secure = process.env.COOKIE_SECURE === "true" || req?.headers.get("x-forwarded-proto")?.split(",")[0].trim() === "https" || req?.url.startsWith("https://");
  return { httpOnly: true, secure: !!secure, sameSite: "lax" as const, path: "/", maxAge: SESSION_TTL_SECONDS };
}

export type PublicUser = {
  id: string; username: string; displayName: string; avatar: string | null;
  bio: string; isSystem: boolean; createdAt: string;
};

// Public profiles and comments never include the email address or the password hash.
export function publicUser(u: typeof users.$inferSelect): PublicUser {
  return {
    id: u.id, username: u.username, displayName: u.displayName, avatar: u.avatar,
    bio: u.bio ?? "", isSystem: !!u.isSystem, createdAt: u.createdAt.toISOString(),
  };
}

export async function getUserById(id: string) {
  return (await db.select().from(users).where(eq(users.id, id)).limit(1))[0] ?? null;
}
export async function getUserByUsername(username: string) {
  return (await db.select().from(users).where(eq(users.username, username)).limit(1))[0] ?? null;
}
