import { NextResponse } from "next/server";
import { db } from "@/db";
import { playlistTracks, playlists, tracks } from "@/db/schema";
import { asc, desc, eq } from "drizzle-orm";
import { currentUserId } from "@/lib/auth";
import { playlistToApi } from "@/lib/api";

export const dynamic = "force-dynamic";
const OK = (body: unknown, init?: ResponseInit) => NextResponse.json(body, { ...init, headers: { "Cache-Control": "private, no-store", ...(init?.headers ?? {}) } });
type Ctx = { params: Promise<{ id: string }> };

async function getOwnedPlaylist(id: string, me: string | null) {
  const row = (await db.select().from(playlists).where(eq(playlists.id, id)).limit(1))[0];
  if (!row) return null;
  if (row.ownerId !== me) return null;
  return row;
}

export async function POST(req: Request, { params }: Ctx) {
  try {
    const me = await currentUserId();
    if (!me) return OK({ error: "Zaloguj się" }, { status: 401 });
    const { id } = await params;
    const pl = await getOwnedPlaylist(id, me);
    if (!pl) return OK({ error: "Brak uprawnień" }, { status: 403 });
    const body = await req.json();
    const trackId = String(body.trackId || "");
    const exists = (await db.select().from(tracks).where(eq(tracks.id, trackId)).limit(1))[0];
    if (!exists) return OK({ error: "Nie znaleziono utworu" }, { status: 404 });
    const pos = await db
      .select({ n: playlistTracks.position })
      .from(playlistTracks)
      .where(eq(playlistTracks.playlistId, id))
      .orderBy(desc(playlistTracks.position))
      .limit(1);
    const position = typeof body.position === "number" ? body.position : (pos[0]?.n ?? -1) + 1;
    // unikamy duplikatów
    const rows = await db
      .select({ id: playlistTracks.id, trackId: playlistTracks.trackId })
      .from(playlistTracks)
      .where(eq(playlistTracks.playlistId, id));
    if (rows.some((r) => r.trackId === trackId)) return OK({ error: "Ten utwór jest już w playlistach", duplicate: true }, { status: 409 });
    await db.insert(playlistTracks).values({ playlistId: id, trackId, position });
    const row2 = await getOwnedPlaylist(id, me);
    return OK({ playlist: await playlistToApi(row2!, me) });
  } catch (e) {
    console.error("[playlist:tracks:add]", e);
    return OK({ error: "Błąd serwera" }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: Ctx) {
  try {
    const me = await currentUserId();
    if (!me) return OK({ error: "Zaloguj się" }, { status: 401 });
    const { id } = await params;
    const pl = await getOwnedPlaylist(id, me);
    if (!pl) return OK({ error: "Brak uprawnień" }, { status: 403 });
    const body = await req.json();
    if (!Array.isArray(body.trackIds)) return OK({ error: "Nieprawidłowa kolejność" }, { status: 400 });
    const trackIds = body.trackIds.map(String);
    const rows = await db
      .select({ id: playlistTracks.id, trackId: playlistTracks.trackId })
      .from(playlistTracks)
      .where(eq(playlistTracks.playlistId, id));
    const map = new Map(rows.map((r) => [r.trackId, r.id]));
    for (const [i, tid] of trackIds.entries()) {
      const rowId = map.get(tid);
      if (rowId) {
        await db.update(playlistTracks).set({ position: i }).where(eq(playlistTracks.id, rowId));
      } else {
        const exists = (await db.select({ id: tracks.id }).from(tracks).where(eq(tracks.id, tid)).limit(1))[0];
        if (exists) await db.insert(playlistTracks).values({ playlistId: id, trackId: tid, position: i });
      }
    }
    const removed = [...map.entries()].filter(([tid]) => !trackIds.includes(tid)).map(([, rowId]) => rowId);
    if (removed.length) {
      for (const rowId of removed) await db.delete(playlistTracks).where(eq(playlistTracks.id, rowId));
    }
    const row2 = await getOwnedPlaylist(id, me);
    return OK({ playlist: await playlistToApi(row2!, me) });
  } catch (e) {
    console.error("[playlist:tracks:order]", e);
    return OK({ error: "Błąd serwera" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const me = await currentUserId();
    if (!me) return OK({ error: "Zaloguj się" }, { status: 401 });
    const { id } = await params;
    const pl = await getOwnedPlaylist(id, me);
    if (!pl) return OK({ error: "Brak uprawnień" }, { status: 403 });
    const body = await req.json();
    const trackId = String(body.trackId || "");
    const rows = await db
      .select({ id: playlistTracks.id })
      .from(playlistTracks)
      .where(eq(playlistTracks.playlistId, id));
    for (const r of rows) {
      const t = (await db.select({ trackId: playlistTracks.trackId }).from(playlistTracks).where(eq(playlistTracks.id, r.id)).limit(1))[0];
      if (t && t.trackId === trackId) await db.delete(playlistTracks).where(eq(playlistTracks.id, r.id));
    }
    const row2 = await getOwnedPlaylist(id, me);
    return OK({ playlist: await playlistToApi(row2!, me) });
  } catch (e) {
    console.error("[playlist:tracks:remove]", e);
    return OK({ error: "Błąd serwera" }, { status: 500 });
  }
}
