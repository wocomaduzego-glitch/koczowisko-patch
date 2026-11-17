import { NextResponse } from "next/server";
import { db } from "@/db";
import { friendRequests, follows, users } from "@/db/schema";
import { and, desc, eq, or } from "drizzle-orm";
import { currentUserId, publicUser } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";

const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET() {
  try {
    const me = await currentUserId();
    if (!me) return json({ error: "Zaloguj się" }, 401);
    const [incoming, outgoing, accepted] = await Promise.all([
      db.select().from(friendRequests).where(and(eq(friendRequests.receiverId, me), eq(friendRequests.status, "pending"))).orderBy(desc(friendRequests.createdAt)),
      db.select().from(friendRequests).where(and(eq(friendRequests.senderId, me), eq(friendRequests.status, "pending"))).orderBy(desc(friendRequests.createdAt)),
      db.select().from(friendRequests).where(and(or(eq(friendRequests.senderId, me), eq(friendRequests.receiverId, me)), eq(friendRequests.status, "accepted"))),
    ]);
    const ids = [...new Set([...incoming.map(x => x.senderId), ...outgoing.map(x => x.receiverId), ...accepted.map(x => x.senderId === me ? x.receiverId : x.senderId)])];
    const people = ids.length ? await db.select().from(users).where(or(...ids.map(id => eq(users.id, id)))) : [];
    const byId = new Map(people.map(u => [u.id, publicUser(u)]));
    return json({
      friends: accepted.map(x => byId.get(x.senderId === me ? x.receiverId : x.senderId)).filter(Boolean),
      incoming: incoming.map(x => ({ id: x.senderId, user: byId.get(x.senderId) })).filter(x => x.user),
      outgoing: outgoing.map(x => ({ id: x.receiverId, user: byId.get(x.receiverId) })).filter(x => x.user),
    });
  } catch (e) { console.error("[friends:get]", e); return json({ error: "Błąd serwera" }, 500); }
}

export async function POST(req: Request) {
  try {
    const me = await currentUserId();
    if (!me) return json({ error: "Zaloguj się" }, 401);
    const body = await req.json();
    const action = String(body.action || "");
    const targetId = String(body.userId || "");
    if (!targetId || targetId === me) return json({ error: "Nieprawidłowy użytkownik" }, 400);
    const target = (await db.select({ id: users.id }).from(users).where(eq(users.id, targetId)).limit(1))[0];
    if (!target) return json({ error: "Nie znaleziono użytkownika" }, 404);
    if (action === "send") {
      const existing = (await db.select().from(friendRequests).where(or(
        and(eq(friendRequests.senderId, me), eq(friendRequests.receiverId, targetId)),
        and(eq(friendRequests.senderId, targetId), eq(friendRequests.receiverId, me))
      )).limit(1))[0];
      if (existing?.status === "accepted") return json({ ok: true, status: "accepted" });
      if (existing?.senderId === targetId && existing.status === "pending") {
        await db.update(friendRequests).set({ status: "accepted" }).where(and(eq(friendRequests.senderId, targetId), eq(friendRequests.receiverId, me)));
        await db.insert(follows).values([{ followerId: me, followeeId: targetId }, { followerId: targetId, followeeId: me }]).onConflictDoNothing();
        await createNotification({ userId: targetId, actorId: me, type: "friend_accepted", title: "Zaproszenie zaakceptowane", body: "Wasze zaproszenie do znajomych zostało zaakceptowane.", href: "friends" });
        return json({ ok: true, status: "accepted" });
      }
      if (!existing) {
        await db.insert(friendRequests).values({ senderId: me, receiverId: targetId });
        await createNotification({ userId: targetId, actorId: me, type: "friend_request", title: "Nowe zaproszenie", body: "Ktoś chce dodać Cię do znajomych.", href: "friends" });
      }
      return json({ ok: true, status: "pending" });
    }
    if (action === "accept") {
      const updated = await db.update(friendRequests).set({ status: "accepted" }).where(and(eq(friendRequests.senderId, targetId), eq(friendRequests.receiverId, me), eq(friendRequests.status, "pending"))).returning();
      if (!updated.length) return json({ error: "Zaproszenie nie istnieje" }, 404);
      await db.insert(follows).values([{ followerId: me, followeeId: targetId }, { followerId: targetId, followeeId: me }]).onConflictDoNothing();
      await createNotification({ userId: targetId, actorId: me, type: "friend_accepted", title: "Zaproszenie zaakceptowane", body: "Wasze zaproszenie do znajomych zostało zaakceptowane.", href: "friends" });
      return json({ ok: true });
    }
    if (action === "decline" || action === "remove") {
      await db.delete(friendRequests).where(or(
        and(eq(friendRequests.senderId, me), eq(friendRequests.receiverId, targetId)),
        and(eq(friendRequests.senderId, targetId), eq(friendRequests.receiverId, me))
      ));
      await db.delete(follows).where(or(
        and(eq(follows.followerId, me), eq(follows.followeeId, targetId)),
        and(eq(follows.followerId, targetId), eq(follows.followeeId, me))
      ));
      return json({ ok: true });
    }
    return json({ error: "Nieznana akcja" }, 400);
  } catch (e) { console.error("[friends:post]", e); return json({ error: "Błąd serwera" }, 500); }
}
