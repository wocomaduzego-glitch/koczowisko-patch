import { NextResponse } from "next/server";
import { db } from "@/db";
import { follows, playlists, tracks, users, playlistLikes, trackLikes } from "@/db/schema";
import { and, count, eq } from "drizzle-orm";
import { currentUserId, getUserByUsername, publicUser } from "@/lib/auth";
import { fetchTracksWithNames, listTracks, playlistToApi } from "@/lib/api";
import { badgesForUser, syncAutomaticBadges } from "@/lib/badges";

const OK = NextResponse.json;
type Ctx = { params: Promise<{ name: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const me = await currentUserId();
    const { name } = await params;
    const u = await getUserByUsername(name);
    if (!u) return OK({ error: "Nie znaleziono użytkownika" }, { status: 404 });

    const followers = (await db.select({ n: count() }).from(follows).where(eq(follows.followeeId, u.id)))[0]?.n ?? 0;
    const following = (await db.select({ n: count() }).from(follows).where(eq(follows.followerId, u.id)))[0]?.n ?? 0;
    const followedByMe = me
      ? (await db.select({ n: count() }).from(follows).where(and(eq(follows.followerId, me), eq(follows.followeeId, u.id))))[0]?.n
      : 0;

    const pls = await db
      .select()
      .from(playlists)
      .where(and(eq(playlists.ownerId, u.id), eq(playlists.isPrivate, false)))
      .limit(30);
    const plsApi = [];
    for (const p of pls) plsApi.push(await playlistToApi(p, me));

    const added = await db.select().from(tracks).where(eq(tracks.addedBy, u.id)).limit(50);
    const tracksApi = await fetchTracksWithNames(
      added.map((t) => ({
        id: t.id,
        title: t.title,
        artist: t.artist,
        album: t.album ?? "",
        duration: t.duration ?? 0,
        path: t.path,
        cover: t.cover,
        addedBy: t.addedBy,
        addedByName: null,
        isDemo: !!t.isDemo,
        likes: 0,
        liked: false,
        hasLyrics: false,
        commentCount: 0,
        createdAt: t.createdAt.toISOString(),
      })),
      me
    );
    void listTracks; void trackLikes;

    await syncAutomaticBadges(u.id);
    return OK({
      profile: {
        user: publicUser(u),
        followers,
        following,
        followedByMe: !!followedByMe,
        playlistCount: plsApi.length,
        trackCount: tracksApi.length,
      },
      playlists: plsApi,
      tracks: tracksApi,
      badges: await badgesForUser(u.id),
    });
  } catch (e) {
    console.error("[users:profile]", e);
    return OK({ error: "Błąd serwera" }, { status: 500 });
  }
}
