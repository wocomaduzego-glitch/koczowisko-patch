import { NextResponse } from "next/server";
import { db } from "@/db";
import { lyrics, tracks, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { currentUserId } from "@/lib/auth";
import { getUserById } from "@/lib/auth";
import type { LyricLine } from "@/db/schema";

const OK = NextResponse.json;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const trackId = url.searchParams.get("trackId") || "";
    if (!trackId) return OK({ error: "Brak trackId" }, { status: 400 });
    const row = (await db.select().from(lyrics).where(eq(lyrics.trackId, trackId)).limit(1))[0];
    if (!row) return OK({ lyrics: null });
    const author = row.authorId ? await getUserById(row.authorId) : null;
    return OK({
      lyrics: {
        trackId,
        synced: !!row.synced,
        authorName: author?.displayName ?? null,
        lines: row.lines as LyricLine[],
      },
    });
  } catch (e) {
    console.error("[lyrics]", e);
    return OK({ error: "Błąd serwera" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const me = await currentUserId();
    if (!me) return OK({ error: "Zaloguj się, aby dodać tekst" }, { status: 401 });
    const body = await req.json();
    const trackId = String(body.trackId || "");
    const rawLines = Array.isArray(body.lines) ? body.lines : String(body.lines || "").split("\n");
    const lines: LyricLine[] = [];
    for (const raw of rawLines) {
      if (typeof raw === "string") {
        const m = raw.match(/^\s*(\d{1,2}):(\d{2})\s*[-–]?\s*(.*)$/);
        if (m) lines.push({ t: parseInt(m[1], 10) * 60 + parseInt(m[2], 10), x: m[3].trim() });
        else if (raw.trim()) lines.push({ x: raw.trim() });
      } else if (raw && typeof raw === "object" && "x" in raw && String((raw as LyricLine).x).trim()) {
        lines.push({ t: (raw as LyricLine).t, x: String((raw as LyricLine).x).trim() });
      }
    }
    if (!lines.length) return OK({ error: "Tekst jest pusty" }, { status: 400 });
    if (lines.length > 200) return OK({ error: "Zbyt dużo linijek (max 200)" }, { status: 400 });
    const t = (await db.select({ id: tracks.id }).from(tracks).where(eq(tracks.id, trackId)).limit(1))[0];
    if (!t) return OK({ error: "Nie znaleziono utworu" }, { status: 404 });
    const synced = lines.some((l) => typeof l.t === "number");
    const author = await getUserById(me);
    await db
      .insert(lyrics)
      .values({ trackId, authorId: me, synced, lines })
      .onConflictDoUpdate({ target: lyrics.trackId, set: { authorId: me, synced, lines } });
    return OK({
      lyrics: { trackId, synced, authorName: author?.displayName ?? null, lines },
    });
  } catch (e) {
    console.error("[lyrics:post]", e);
    return OK({ error: "Błąd serwera" }, { status: 500 });
  }
}
