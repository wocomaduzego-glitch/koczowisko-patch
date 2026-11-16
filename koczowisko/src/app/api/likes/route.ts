import { NextResponse } from "next/server";
import { db } from "@/db";
import { playlistLikes, playlists, trackLikes, tracks } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { currentUserId } from "@/lib/auth";

const OK = NextResponse.json;

export async function POST(req: Request) {
  try {
    const me = await currentUserId();
    if (!me) return OK({ error: "Zaloguj się, aby polubić" }, { status: 401 });
    const body = await req.json();
    const kind = body.kind as "track" | "playlist";
    const id = String(body.id || "");
    let liked = false;

    if (kind === "track") {
      const exists = (await db.select({ id: tracks.id }).from(tracks).where(eq(tracks.id, id)).limit(1))[0];
      if (!exists) return OK({ error: "Nie znaleziono utworu" }, { status: 404 });
      const current = (
        await db.select().from(trackLikes).where(and(eq(trackLikes.userId, me), eq(trackLikes.trackId, id))).limit(1)
      )[0];
      if (current) {
        await db.delete(trackLikes).where(and(eq(trackLikes.userId, me), eq(trackLikes.trackId, id)));
      } else {
        await db.insert(trackLikes).values({ userId: me, trackId: id });
        liked = true;
      }
    } else {
      const exists = (await db.select({ id: playlists.id }).from(playlists).where(eq(playlists.id, id)).limit(1))[0];
      if (!exists) return OK({ error: "Nie znaleziono playlisty" }, { status: 404 });
      const current = (
        await db.select().from(playlistLikes).where(and(eq(playlistLikes.userId, me), eq(playlistLikes.playlistId, id))).limit(1)
      )[0];
      if (current) {
        await db.delete(playlistLikes).where(and(eq(playlistLikes.userId, me), eq(playlistLikes.playlistId, id)));
      } else {
        await db.insert(playlistLikes).values({ userId: me, playlistId: id });
        liked = true;
      }
    }
    return OK({ liked });
  } catch (e) {
    console.error("[likes]", e);
    return OK({ error: "Błąd serwera" }, { status: 500 });
  }
}
