import { NextResponse } from "next/server";
import { db } from "@/db";
import { playlists } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { currentUserId } from "@/lib/auth";
import { requireCreatorAdmin } from "@/lib/permissions";
import { playlistToApi } from "@/lib/api";

export const dynamic = "force-dynamic";
const OK = (body: unknown, init?: ResponseInit) => NextResponse.json(body, { ...init, headers: { "Cache-Control": "private, no-store", ...(init?.headers ?? {}) } });
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const me = await currentUserId();
    const { id } = await params;
    const row = (await db.select().from(playlists).where(eq(playlists.id, id)).limit(1))[0];
    if (!row) return OK({ error: "Nie znaleziono playlisty" }, { status: 404 });
    if (row.isPrivate && row.ownerId !== me)
      return OK({ error: "To prywatna playlista" }, { status: 403 });
    return OK({ playlist: await playlistToApi(row, me) });
  } catch (e) {
    console.error("[playlist:get]", e);
    return OK({ error: "Błąd serwera" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const me = await currentUserId();
    if (!me) return OK({ error: "Zaloguj się" }, { status: 401 });
    const { id } = await params;
    const body = await req.json();
    const set: Record<string, unknown> = {};
    if (typeof body.name === "string" && body.name.trim()) set.name = body.name.trim().slice(0, 60);
    if (typeof body.description === "string") set.description = body.description.trim().slice(0, 300);
    if (typeof body.isPrivate === "boolean") set.isPrivate = body.isPrivate;
    if (typeof body.cover === "string") set.cover = body.cover;
    const rows = await db.update(playlists).set(set).where(and(eq(playlists.id, id), eq(playlists.ownerId, me))).returning();
    if (!rows.length) return OK({ error: "Brak uprawnień do edycji tej playlisty" }, { status: 403 });
    return OK({ playlist: await playlistToApi(rows[0], me) });
  } catch (e) {
    console.error("[playlist:patch]", e);
    return OK({ error: "Błąd serwera" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const me = await currentUserId();
    if (!me) return OK({ error: "Zaloguj się" }, { status: 401 });
    const { id } = await params;
    const isAdmin = await requireCreatorAdmin(me);
    const condition = isAdmin
      ? eq(playlists.id, id)
      : and(eq(playlists.id, id), eq(playlists.ownerId, me));
    const rows = await db.delete(playlists).where(condition).returning({ id: playlists.id });
    if (!rows.length) return OK({ error: "Brak uprawnień do usunięcia tej playlisty lub nie została znaleziona" }, { status: 403 });
    return OK({ ok: true });
  } catch (e) {
    console.error("[playlist:delete]", e);
    return OK({ error: "Błąd serwera" }, { status: 500 });
  }
}
