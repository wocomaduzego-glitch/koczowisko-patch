import { NextResponse } from "next/server";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { asc } from "drizzle-orm";
import { currentUserId } from "@/lib/auth";
import { listTracks, fetchTracksWithNames, trackToApi } from "@/lib/api";
import { randomUUID } from "node:crypto";
import { syncAutomaticBadges } from "@/lib/badges";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const OK = NextResponse.json;
const AUDIO_EXT: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "audio/ogg": "ogg",
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const search = url.searchParams.get("search") || undefined;
    const me = await currentUserId();
    const rows = await listTracks(search, me);
    const withNames = await fetchTracksWithNames(rows, me);
    return OK({ tracks: withNames });
  } catch (e) {
    console.error("[tracks]", e);
    return OK({ error: "Błąd serwera" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const me = await currentUserId();
    if (!me) return OK({ error: "Zaloguj się, aby dodać pliki" }, { status: 401 });
    const form = await req.formData();
    const audio = form.get("audio");
    if (!(audio instanceof File)) return OK({ error: "Brak pliku audio" }, { status: 400 });
    const ext = AUDIO_EXT[audio.type] || (audio.name.split(".").pop() || "").toLowerCase();
    if (!["mp3", "wav", "ogg"].includes(ext))
      return OK({ error: "Obsługiwane formaty: MP3, WAV, OGG" }, { status: 400 });
    if (audio.size > 30 * 1024 * 1024) return OK({ error: "Plik za duży (max 30 MB)" }, { status: 400 });

    const id = randomUUID();
    const dir = path.join(process.cwd(), "uploads", "audio");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, `${id}.${ext}`), Buffer.from(await audio.arrayBuffer()));

    let cover: string | null = null;
    const coverFile = form.get("cover");
    if (coverFile instanceof File && ["image/png", "image/jpeg", "image/webp"].includes(coverFile.type)) {
      if (coverFile.size < 5 * 1024 * 1024) {
        const cext = coverFile.type === "image/png" ? "png" : coverFile.type === "image/webp" ? "webp" : "jpg";
        const cdir = path.join(process.cwd(), "uploads", "covers");
        await mkdir(cdir, { recursive: true });
        await writeFile(path.join(cdir, `${id}.${cext}`), Buffer.from(await coverFile.arrayBuffer()));
        cover = `/api/files/covers/${id}.${cext}`;
      }
    }

    const rows = await db
      .insert(tracks)
      .values({
        title: String(form.get("title") || audio.name.replace(/\.[^.]+$/, "")),
        artist: String(form.get("artist") || "Nieznany wykonawca"),
        album: String(form.get("album") || ""),
        duration: Number(form.get("duration") || 0),
        path: `audio/${id}.${ext}`,
        cover,
        addedBy: me,
        isDemo: false,
      })
      .returning();
    await syncAutomaticBadges(me);
    const meId = await currentUserId();
    return OK({ track: (await fetchTracksWithNames([trackToApi(rows[0], meId)], meId))[0] });
  } catch (e) {
    console.error("[tracks:upload]", e);
    return OK({ error: "Błąd podczas dodawania pliku" }, { status: 500 });
  }
}
