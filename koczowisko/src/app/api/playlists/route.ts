import { NextResponse } from "next/server";
import { db } from "@/db";
import { playlists } from "@/db/schema";
import { currentUserId } from "@/lib/auth";
import { fetchMyPlaylists, fetchPublicPlaylists, playlistToApi } from "@/lib/api";
import { syncAutomaticBadges } from "@/lib/badges";

export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });

export async function GET(req: Request) {
  try {
    const me = await currentUserId();
    const scope = new URL(req.url).searchParams.get("scope");

    if (scope === "mine") {
      if (!me) return json({ playlists: [] });
      return json({ playlists: await fetchMyPlaylists(me) });
    }

    return json({ playlists: await fetchPublicPlaylists(me) });
  } catch (error) {
    console.error("[playlists:get]", error);
    return json({ error: "Błąd serwera" }, 500);
  }
}

export async function POST(req: Request) {
  try {
    const me = await currentUserId();
    if (!me) return json({ error: "Zaloguj się, aby tworzyć playlisty" }, 401);

    const body = await req.json();
    const name = String(body.name || "").trim();
    if (!name || name.length > 60) {
      return json({ error: "Nazwa playlisty: 1–60 znaków" }, 400);
    }

    const rows = await db
      .insert(playlists)
      .values({
        ownerId: me,
        name,
        description: String(body.description || "").trim().slice(0, 300),
        cover: body.cover || null,
        isPrivate: Boolean(body.isPrivate),
        kind: "normal",
      })
      .returning();

    await syncAutomaticBadges(me);
    return json({ playlist: await playlistToApi(rows[0], me) });
  } catch (error) {
    console.error("[playlists:create]", error);
    return json({ error: "Błąd serwera" }, 500);
  }
}
