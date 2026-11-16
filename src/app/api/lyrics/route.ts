import { NextResponse } from "next/server";
import { db } from "@/db";
import { lyrics, tracks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { currentUserId, getUserById } from "@/lib/auth";
import type { LyricLine } from "@/db/schema";

export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });

export async function GET(req: Request) {
  try {
    const trackId = new URL(req.url).searchParams.get("trackId") || "";
    if (!trackId) return json({ error: "Brak trackId" }, 400);

    const row = (await db.select().from(lyrics).where(eq(lyrics.trackId, trackId)).limit(1))[0];
    if (!row) return json({ lyrics: null });

    const author = row.authorId ? await getUserById(row.authorId) : null;
    return json({
      lyrics: {
        trackId,
        synced: Boolean(row.synced),
        authorName: author?.displayName ?? null,
        authorId: row.authorId,
        lines: row.lines as LyricLine[],
      },
    });
  } catch (error) {
    console.error("[lyrics:get]", error);
    return json({ error: "Błąd serwera" }, 500);
  }
}

export async function POST(req: Request) {
  try {
    const me = await currentUserId();
    if (!me) return json({ error: "Zaloguj się, aby dodać tekst" }, 401);

    const body = await req.json();
    const trackId = String(body.trackId || "");
    if (!trackId) return json({ error: "Brak trackId" }, 400);

    const rawLines = Array.isArray(body.lines)
      ? body.lines
      : String(body.lines || "").split("\n");
    const lines: LyricLine[] = [];

    for (const raw of rawLines) {
      if (typeof raw === "string") {
        const match = raw.match(/^\s*(\d{1,2}):(\d{2})\s*[-–]?\s*(.*)$/);
        if (match) {
          lines.push({
            t: parseInt(match[1], 10) * 60 + parseInt(match[2], 10),
            x: match[3].trim(),
          });
        } else if (raw.trim()) {
          lines.push({ x: raw.trim() });
        }
      } else if (
        raw &&
        typeof raw === "object" &&
        "x" in raw &&
        String((raw as LyricLine).x).trim()
      ) {
        lines.push({
          t: (raw as LyricLine).t,
          x: String((raw as LyricLine).x).trim(),
        });
      }
    }

    if (!lines.length) return json({ error: "Tekst jest pusty" }, 400);
    if (lines.length > 200) return json({ error: "Zbyt dużo linijek (max 200)" }, 400);

    const track = (await db
      .select({ id: tracks.id })
      .from(tracks)
      .where(eq(tracks.id, trackId))
      .limit(1))[0];

    if (!track) return json({ error: "Nie znaleziono utworu" }, 404);

    const synced = lines.some((line) => typeof line.t === "number");
    const values = { authorId: me, synced, lines };

    // Pierwszy zapis może dodać każdy zalogowany użytkownik. Kolejne edycje
    // są dozwolone wyłącznie autorowi istniejącego tekstu.
    const inserted = await db
      .insert(lyrics)
      .values({ trackId, ...values })
      .onConflictDoNothing()
      .returning();

    if (!inserted.length) {
      const existing = (await db
        .select({ authorId: lyrics.authorId })
        .from(lyrics)
        .where(eq(lyrics.trackId, trackId))
        .limit(1))[0];

      if (!existing) return json({ error: "Nie udało się zapisać tekstu" }, 409);
      if (existing.authorId !== me) {
        return json({ error: "Tylko autor tego tekstu może go edytować" }, 403);
      }

      await db.update(lyrics).set(values).where(eq(lyrics.trackId, trackId));
    }

    const author = await getUserById(me);
    return json({
      lyrics: {
        trackId,
        synced,
        authorName: author?.displayName ?? null,
        authorId: me,
        lines,
      },
    });
  } catch (error) {
    console.error("[lyrics:post]", error);
    return json({ error: "Błąd serwera" }, 500);
  }
}
