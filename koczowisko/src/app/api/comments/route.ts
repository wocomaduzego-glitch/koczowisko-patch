import { NextResponse } from "next/server";
import { db } from "@/db";
import { comments, tracks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { currentUserId } from "@/lib/auth";
import { commentsForTrack } from "@/lib/api";

const OK = NextResponse.json;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const trackId = url.searchParams.get("trackId") || "";
    if (!trackId) return OK({ error: "Brak trackId" }, { status: 400 });
    return OK({ comments: await commentsForTrack(trackId) });
  } catch (e) {
    console.error("[comments]", e);
    return OK({ error: "Błąd serwera" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const me = await currentUserId();
    if (!me) return OK({ error: "Zaloguj się, aby komentować" }, { status: 401 });
    const body = await req.json();
    const trackId = String(body.trackId || "");
    const text = String(body.body || "").trim();
    const parentId = body.parentId ? String(body.parentId) : null;
    if (!text || text.length > 500) return OK({ error: "Komentarz: 1–500 znaków" }, { status: 400 });
    const t = (await db.select({ id: tracks.id }).from(tracks).where(eq(tracks.id, trackId)).limit(1))[0];
    if (!t) return OK({ error: "Nie znaleziono utworu" }, { status: 404 });
    if (parentId) {
      const parent = (await db.select({ id: comments.id }).from(comments).where(eq(comments.id, parentId)).limit(1))[0];
      if (!parent) return OK({ error: "Nie znaleziono komentarza" }, { status: 404 });
    }
    await db.insert(comments).values({ trackId, userId: me, parentId, body: text });
    return OK({ comments: await commentsForTrack(trackId) });
  } catch (e) {
    console.error("[comments:post]", e);
    return OK({ error: "Błąd serwera" }, { status: 500 });
  }
}
