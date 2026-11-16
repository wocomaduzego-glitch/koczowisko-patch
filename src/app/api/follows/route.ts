import { NextResponse } from "next/server";
import { db } from "@/db";
import { follows, users } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { currentUserId } from "@/lib/auth";

const OK = NextResponse.json;

export async function POST(req: Request) {
  try {
    const me = await currentUserId();
    if (!me) return OK({ error: "Zaloguj się" }, { status: 401 });
    const body = await req.json();
    const userId = String(body.userId || "");
    if (userId === me) return OK({ error: "Nie można obserwować samego siebie" }, { status: 400 });
    const target = (await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1))[0];
    if (!target) return OK({ error: "Nie znaleziono użytkownika" }, { status: 404 });
    const current = (
      await db.select().from(follows).where(and(eq(follows.followerId, me), eq(follows.followeeId, userId))).limit(1)
    )[0];
    let following = false;
    if (current) {
      await db.delete(follows).where(and(eq(follows.followerId, me), eq(follows.followeeId, userId)));
    } else {
      await db.insert(follows).values({ followerId: me, followeeId: userId });
      following = true;
    }
    return OK({ following });
  } catch (e) {
    console.error("[follows]", e);
    return OK({ error: "Błąd serwera" }, { status: 500 });
  }
}
