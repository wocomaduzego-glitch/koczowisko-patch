import { NextResponse } from "next/server";
import { db } from "@/db";
import { playlists } from "@/db/schema";
import { currentUserId } from "@/lib/auth";
import { fetchMyPlaylists, fetchPublicPlaylists, playlistToApi } from "@/lib/api";
import { syncAutomaticBadges } from "@/lib/badges";

const OK = NextResponse.json;

export async function GET(req: Request) {
  try {
    const me = await currentUserId();
    const url = new URL(req.url);
    const scope = url.searchParams.get("scope");
    if (scope === "mine") {
      if (!me) return OK({ playlists: [] });
      return OK({ playlists: await fetchMyPlaylists(me) });
    }
    return OK({ playlists: await fetchPublicPlaylists(me) });
  } catch (e) {
    console.error("[playlists]", e);
    return OK({ error: "Błąd serwera" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const me = await currentUserId();
    if (!me) return OK({ error: "Zaloguj się, aby tworzyć playlisty" }, { status: 401 });
    const body = await req.json();
    const name = String(body.name || "").trim();
    if (!name || name.length > 60) return OK({ error: "Nazwa playlisty: 1–60 znaków" }, { status: 400 });
    const rows = await db
      .insert(playlists)
      .values({
        ownerId: me,
        name,
        description: String(body.description || "").trim().slice(0, 300),
        cover: body.cover || null,
        isPrivate: !!body.isPrivate,
        kind: "normal",
      })
      .returning();
    await syncAutomaticBadges(me);
    const pl = await playlistToApi(rows[0], me);
    return OK({ playlist: pl });
  } catch (e) {
    console.error("[playlists:create]", e);
    return OK({ error: "Błąd serwera" }, { status: 500 });
  }
}
