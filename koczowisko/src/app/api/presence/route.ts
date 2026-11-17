import { NextResponse } from "next/server";
import { db } from "@/db";
import { listeningPresence, tracks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { currentUserId } from "@/lib/auth";

const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });

export async function POST(req: Request) {
  try {
    const me = await currentUserId();
    if (!me) return json({ error: "Zaloguj się" }, 401);
    const body = await req.json();
    const trackId = String(body.trackId || "");
    if (!trackId) return json({ error: "Brak trackId" }, 400);
    const exists = await db.select({ id: tracks.id }).from(tracks).where(eq(tracks.id, trackId)).limit(1);
    if (!exists.length) return json({ error: "Nie znaleziono utworu" }, 404);
    await db.insert(listeningPresence).values({ userId: me, trackId, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: listeningPresence.userId,
        set: { trackId, updatedAt: new Date() },
      });
    return json({ ok: true });
  } catch (error) {
    console.error("[presence:post]", error);
    return json({ error: "Błąd serwera" }, 500);
  }
}

export async function DELETE() {
  try {
    const me = await currentUserId();
    if (!me) return json({ error: "Zaloguj się" }, 401);
    await db.delete(listeningPresence).where(eq(listeningPresence.userId, me));
    return json({ ok: true });
  } catch (error) {
    console.error("[presence:delete]", error);
    return json({ error: "Błąd serwera" }, 500);
  }
}
