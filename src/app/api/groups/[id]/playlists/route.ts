import { NextResponse } from "next/server";
import { db } from "@/db";
import { groupMembers, groupPlaylists, playlists } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { currentUserId } from "@/lib/auth";
import { groupDetail } from "@/lib/api";

const OK = NextResponse.json;
type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  try {
    const me = await currentUserId();
    if (!me) return OK({ error: "Zaloguj się" }, { status: 401 });
    const { id } = await params;
    const body = await req.json();
    const playlistId = String(body.playlistId || "");
    const membership = (await db.select().from(groupMembers).where(eq(groupMembers.groupId, id)).limit(500)).find((m) => m.userId === me);
    if (!membership) return OK({ error: "Najpierw dołącz do grupy" }, { status: 403 });
    const pl = (await db.select().from(playlists).where(and(eq(playlists.id, playlistId), eq(playlists.ownerId, me))).limit(1))[0];
    if (!pl) return OK({ error: "Możesz udostępnić tylko własną playlistę" }, { status: 403 });
    if (pl.isPrivate) return OK({ error: "Aby udostępnić playlistę w grupie, najpierw ustaw ją jako publiczną." }, { status: 400 });
    const exists = (await db.select().from(groupPlaylists).where(and(eq(groupPlaylists.groupId, id), eq(groupPlaylists.playlistId, playlistId))).limit(1))[0];
    if (exists) return OK({ error: "Playlista jest już w grupie" }, { status: 409 });
    await db.insert(groupPlaylists).values({ groupId: id, playlistId });
    const g = await groupDetail(id, me);
    return OK({ group: g });
  } catch (e) {
    console.error("[group:playlists]", e);
    return OK({ error: "Błąd serwera" }, { status: 500 });
  }
}
