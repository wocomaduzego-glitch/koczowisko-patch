import { NextResponse } from "next/server";
import { db } from "@/db";
import { tracks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { currentUserId } from "@/lib/auth";
import { requireCreatorAdmin } from "@/lib/permissions";
import { fetchTracksWithNames, trackToApi } from "@/lib/api";
import { unlink } from "node:fs/promises";
import path from "node:path";

const OK = NextResponse.json;

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const me = await currentUserId();
    if (!me) return OK({ error: "Zaloguj się" }, { status: 401 });
    const { id } = await params;
    const existing = (await db.select().from(tracks).where(eq(tracks.id, id)).limit(1))[0];
    if (!existing) return OK({ error: "Nie znaleziono utworu" }, { status: 404 });
    if (existing.addedBy !== me) return OK({ error: "Możesz edytować tylko własne utwory" }, { status: 403 });
    const body = await req.json();
    const patch: Record<string, unknown> = {};
    if (typeof body.duration === "number" && body.duration > 0) patch.duration = Math.round(body.duration);
    if (patch.duration === undefined) return OK({ error: "Brak zmian" }, { status: 400 });
    const rows = await db.update(tracks).set(patch).where(eq(tracks.id, id)).returning();
    if (!rows.length) return OK({ error: "Nie znaleziono utworu" }, { status: 404 });
    return OK({ track: (await fetchTracksWithNames([trackToApi(rows[0], me)], me))[0] });
  } catch (e) {
    console.error("[tracks:patch]", e);
    return OK({ error: "Błąd serwera" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const me = await currentUserId();
    if (!me) return OK({ error: "Zaloguj się" }, { status: 401 });
    const { id } = await params;
    const row = (await db.select().from(tracks).where(eq(tracks.id, id)).limit(1))[0];
    if (!row) return OK({ error: "Nie znaleziono utworu" }, { status: 404 });
    const isAdmin = await requireCreatorAdmin(me);
    if (row.addedBy !== me && !isAdmin) return OK({ error: "Możesz usunąć tylko własne pliki" }, { status: 403 });
    await db.delete(tracks).where(eq(tracks.id, id));
    try {
      await unlink(path.join(process.cwd(), "uploads", row.path));
    } catch {
      /* plik mógł nie istnieć */
    }
    return OK({ ok: true });
  } catch (e) {
    console.error("[tracks:delete]", e);
    return OK({ error: "Błąd serwera" }, { status: 500 });
  }
}
