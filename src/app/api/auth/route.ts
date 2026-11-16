import { NextResponse } from "next/server";
import { db } from "@/db";
import { settings, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  currentSession, getUserById, getUserByUsername, hashPassword, makeToken,
  publicUser, renewSession, revokeSession, userCookieOptions, verifyPassword, COOKIE,
} from "@/lib/auth";
import { deleteAccountData } from "@/lib/account-data";
import { getSettings } from "@/lib/api";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
const clearCookie = (res: NextResponse) => { res.cookies.set(COOKIE, "", { path: "/", maxAge: 0 }); return res; };

export async function GET(req: Request) {
  try {
    const session = await currentSession();
    if (!session) return clearCookie(json({ user: null, settings: null }));
    await renewSession(session.token);
    const res = json({ user: publicUser(session.user), settings: await getSettings(session.user.id), token: session.token });
    res.cookies.set(COOKIE, session.token, userCookieOptions(req));
    return res;
  } catch (e) {
    console.error("[auth:get]", e);
    return json({ error: "Nie można sprawdzić sesji. Spróbuj ponownie." }, 503);
  }
}

export async function POST(req: Request) {
  try {
    if ((req.headers.get("content-type") || "").includes("multipart/form-data")) {
      const session = await currentSession();
      if (!session) return json({ error: "Zaloguj się, aby zmienić awatar" }, 401);
      const file = (await req.formData()).get("avatar");
      if (!(file instanceof File)) return json({ error: "Brak pliku" }, 400);
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return json({ error: "Dozwolone formaty: PNG, JPEG, WebP" }, 400);
      if (file.size > 5 * 1024 * 1024) return json({ error: "Plik za duży (max 5 MB)" }, 400);
      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const dir = path.join(process.cwd(), "uploads", "avatars");
      await mkdir(dir, { recursive: true });
      const name = `${session.user.id}-${randomUUID()}.${ext}`;
      await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
      await db.update(users).set({ avatar: `/api/files/avatars/${name}` }).where(eq(users.id, session.user.id));
      return json({ user: publicUser((await getUserById(session.user.id))!) });
    }

    const body = await req.json();
    if (body.action === "register") {
      const username = String(body.username || "").trim().toLowerCase();
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const displayName = String(body.displayName || "").trim() || username;
      if (!/^[a-z0-9_]{3,20}$/.test(username)) return json({ error: "Nazwa użytkownika: 3–20 znaków, małe litery, cyfry i _" }, 400);
      if (email.length > 254 || !/^\S+@\S+\.\S+$/.test(email)) return json({ error: "Podaj poprawny e-mail" }, 400);
      if (password.length < 6 || password.length > 256) return json({ error: "Hasło musi mieć 6–256 znaków" }, 400);
      if (displayName.length > 40) return json({ error: "Nazwa wyświetlana może mieć do 40 znaków" }, 400);
      if (await getUserByUsername(username) || (await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)).length)
        return json({ error: "Nazwa użytkownika lub e-mail jest już zajęty" }, 409);
      const user = await db.transaction(async (tx) => {
        const u = (await tx.insert(users).values({ username, email, displayName, passwordHash: hashPassword(password) }).returning())[0];
        await tx.insert(settings).values({ userId: u.id, data: {} });
        return u;
      });
      const token = await makeToken(user.id);
      const res = json({ user: publicUser(user), token });
      res.cookies.set(COOKIE, token, userCookieOptions(req));
      return res;
    }

    if (body.action === "login") {
      const login = String(body.username || "").trim().toLowerCase();
      const password = String(body.password || "");
      if (!login || !password) return json({ error: "Wpisz login lub e-mail oraz hasło" }, 400);
      const user = await getUserByUsername(login) || (await db.select().from(users).where(eq(users.email, login)).limit(1))[0];
      if (!user || !verifyPassword(password, user.passwordHash)) return json({ error: "Nieprawidłowy login lub hasło" }, 401);
      const token = await makeToken(user.id);
      const res = json({ user: publicUser(user), token });
      res.cookies.set(COOKIE, token, userCookieOptions(req));
      return res;
    }

    if (body.action === "logout") {
      await revokeSession();
      return clearCookie(json({ ok: true }));
    }

    const session = await currentSession();
    if (!session) return json({ error: "Zaloguj się" }, 401);
    if (body.action === "update") {
      const displayName = String(body.displayName || "").trim();
      const bio = String(body.bio || "").trim();
      if (!displayName || displayName.length > 40 || bio.length > 500) return json({ error: "Nazwa: 1–40 znaków; bio: do 500 znaków" }, 400);
      const user = (await db.update(users).set({ displayName, bio }).where(eq(users.id, session.user.id)).returning())[0];
      return json({ user: publicUser(user) });
    }
    if (body.action === "delete") {
      if (!verifyPassword(String(body.password || ""), session.user.passwordHash)) return json({ error: "Nieprawidłowe hasło" }, 400);
      await deleteAccountData(session.user.id);
      return clearCookie(json({ ok: true }));
    }
    return json({ error: "Nieznana akcja" }, 400);
  } catch (e) {
    if ((e as { cause?: { code?: string } }).cause?.code === "23505") return json({ error: "Nazwa użytkownika lub e-mail jest już zajęty" }, 409);
    console.error("[auth]", e);
    return json({ error: "Nie udało się wykonać operacji. Spróbuj ponownie." }, 500);
  }
}
