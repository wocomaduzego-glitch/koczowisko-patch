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

    const parseTimestamp = (value: string): number | null => {
      const match = value.trim().match(/^(?:(\\d{1,2}):)?(\\d{1,2}):(\\d{2})(?:[.,](\\d{1,3}))?$/);
      if (!match) return null;
      const hours = Number(match[1] ?? 0);
      const minutes = Number(match[2]);
      const seconds = Number(match[3]);
      if (minutes > 59 || seconds > 59) return null;
      return hours * 3600 + minutes * 60 + seconds;
    };

    for (const raw of rawLines) {
      if (typeof raw === "string") {
        const lrc = raw.match(/^\\s*((?:\\[\\d{1,2}:\\d{2}(?:[.,]\\d{1,3})?\\])+)(.*)$/);
        if (lrc) {
          const stamps = [...lrc[1].matchAll(/\\[(\\d{1,2}:\\d{2}(?:[.,]\\d{1,3})?)\\]/g)];
          for (const stamp of stamps) {
            const t = parseTimestamp(stamp[1]);
            if (t !== null) lines.push({ t, x: lrc[2].trim() });
          }
          continue;
        }
        const timed = raw.match(/^\\s*((?:\\d{1,2}:)?\\d{1,2}:\\d{2}(?:[.,]\\d{1,3})?)\\s*[-–]?\\s*(.*)$/);
        if (timed) {
          const t = parseTimestamp(timed[1]);
          if (t !== null) lines.push({ t, x: timed[2].trim() });
        } else if (raw.trim()) {
          lines.push({ x: raw.trim() });
        }
      } else if (
        raw && typeof raw === "object" && "x" in raw && String((raw as LyricLine).x).trim()
      ) {
        const candidate = Number((raw as LyricLine).t);
        const t = Number.isFinite(candidate) && candidate >= 0 && candidate <= 86400 ? Math.floor(candidate) : undefined;
        lines.push({ ...(t !== undefined ? { t } : {}), x: String((raw as LyricLine).x).trim() });
      }
    }

    for (const line of lines) {
      if (!line.x || line.x.length > 500) return json({ error: "Każda linijka musi mieć 1–500 znaków" }, 400);
    }

    if (!lines.length) return json({ error: "Tekst jest pusty" }, 400);
    if (lines.length > 200) return json({ error: "Zbyt dużo linijek (max 200)" }, 400);

    const track = (await db
      .select({ id: tracks.id })
      .from(tracks)
      .where(eq(tracks.id, trackId))
      .limit(1))[0];

    if (!track) return json({ error: "Nie znaleziono utworu" }, 404);

    const synced = lines.length > 0 && lines.every((line) => typeof line.t === "number");
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
