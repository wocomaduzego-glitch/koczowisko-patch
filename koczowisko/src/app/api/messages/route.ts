import { NextResponse } from "next/server";
import { db } from "@/db";
import { directMessages, friendRequests, users } from "@/db/schema";
import { and, asc, eq, or } from "drizzle-orm";
import { currentUserId, publicUser } from "@/lib/auth";

const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
async function areFriends(a: string, b: string) {
  const row = await db.select({ senderId: friendRequests.senderId }).from(friendRequests).where(and(
    or(and(eq(friendRequests.senderId, a), eq(friendRequests.receiverId, b)), and(eq(friendRequests.senderId, b), eq(friendRequests.receiverId, a))),
    eq(friendRequests.status, "accepted")
  )).limit(1);
  return row.length > 0;
}
export async function GET(req: Request) {
  try {
    const me = await currentUserId();
    if (!me) return json({ error: "Zaloguj się" }, 401);
    const peer = new URL(req.url).searchParams.get("with") || "";
    if (!peer || !(await areFriends(me, peer))) return json({ error: "Wiadomości są dostępne tylko dla znajomych" }, 403);
    const rows = await db.select().from(directMessages).where(or(
      and(eq(directMessages.senderId, me), eq(directMessages.receiverId, peer)),
      and(eq(directMessages.senderId, peer), eq(directMessages.receiverId, me))
    )).orderBy(asc(directMessages.createdAt)).limit(200);
    await db.update(directMessages).set({ readAt: new Date() }).where(and(eq(directMessages.senderId, peer), eq(directMessages.receiverId, me)));
    const other = (await db.select().from(users).where(eq(users.id, peer)).limit(1))[0];
    return json({ messages: rows.map(m => ({ id: m.id, senderId: m.senderId, receiverId: m.receiverId, body: m.body, readAt: m.readAt?.toISOString() ?? null, createdAt: m.createdAt.toISOString() })), user: other ? publicUser(other) : null });
  } catch (e) { console.error("[messages:get]", e); return json({ error: "Błąd serwera" }, 500); }
}
export async function POST(req: Request) {
  try {
    const me = await currentUserId();
    if (!me) return json({ error: "Zaloguj się" }, 401);
    const body = await req.json();
    const peer = String(body.userId || "");
    const message = String(body.body || "").trim();
    if (!peer || !message || message.length > 2000) return json({ error: "Wiadomość musi mieć 1–2000 znaków" }, 400);
    if (!(await areFriends(me, peer))) return json({ error: "Możesz pisać tylko do znajomych" }, 403);
    const row = (await db.insert(directMessages).values({ senderId: me, receiverId: peer, body: message }).returning())[0];
    return json({ message: { id: row.id, senderId: row.senderId, receiverId: row.receiverId, body: row.body, readAt: null, createdAt: row.createdAt.toISOString() } }, 201);
  } catch (e) { console.error("[messages:post]", e); return json({ error: "Błąd serwera" }, 500); }
}
