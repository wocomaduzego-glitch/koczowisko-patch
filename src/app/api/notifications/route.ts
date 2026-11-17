import { NextResponse } from "next/server";
import { db } from "@/db";
import { notifications, users } from "@/db/schema";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { currentUserId } from "@/lib/auth";

const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET() {
  try {
    const me = await currentUserId();
    if (!me) return json({ error: "Zaloguj się" }, 401);
    const [rows, unreadRow] = await Promise.all([
      db.select({
        id: notifications.id,
        type: notifications.type,
        title: notifications.title,
        body: notifications.body,
        href: notifications.href,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
        actorName: users.displayName,
        actorUsername: users.username,
        actorAvatar: users.avatar,
      }).from(notifications)
        .leftJoin(users, eq(notifications.actorId, users.id))
        .where(eq(notifications.userId, me))
        .orderBy(desc(notifications.createdAt))
        .limit(100),
      db.select({ value: count() }).from(notifications)
        .where(and(eq(notifications.userId, me), isNull(notifications.readAt))),
    ]);
    return json({
      notifications: rows.map((row) => ({
        ...row,
        readAt: row.readAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
      unread: Number(unreadRow[0]?.value ?? 0),
    });
  } catch (error) {
    console.error("[notifications:get]", error);
    return json({ error: "Błąd serwera" }, 500);
  }
}

export async function PATCH(req: Request) {
  try {
    const me = await currentUserId();
    if (!me) return json({ error: "Zaloguj się" }, 401);
    const body = await req.json();
    const now = new Date();
    if (body.all === true) {
      await db.update(notifications).set({ readAt: now })
        .where(and(eq(notifications.userId, me), isNull(notifications.readAt)));
      return json({ ok: true });
    }
    const id = String(body.id || "");
    if (!id) return json({ error: "Brak identyfikatora powiadomienia" }, 400);
    await db.update(notifications).set({ readAt: now })
      .where(and(eq(notifications.id, id), eq(notifications.userId, me), isNull(notifications.readAt)));
    return json({ ok: true });
  } catch (error) {
    console.error("[notifications:patch]", error);
    return json({ error: "Błąd serwera" }, 500);
  }
}
