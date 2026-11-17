import { NextResponse } from "next/server";
import { db } from "@/db";
import { follows, playlists, tracks, users, playlistLikes, trackLikes, settings, friendRequests, listeningPresence } from "@/db/schema";
import { and, count, eq, gt, or } from "drizzle-orm";
import { currentUserId, getUserByUsername, publicUser } from "@/lib/auth";
import { fetchTracksWithNames, listTracks, playlistToApi } from "@/lib/api";
import { badgesForUser } from "@/lib/badges";

const OK = NextResponse.json;
type Ctx = { params: Promise<{ name: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const me = await currentUserId();
    const { name } = await params;
    const u = await getUserByUsername(name);
    if (!u) return OK({ error: "Nie znaleziono użytkownika" }, { status: 404 });
    const prefRow = (await db.select().from(settings).where(eq(settings.userId, u.id)).limit(1))[0];
    const prefs = prefRow?.data ?? {};
    const visibility = prefs.profileVisibility === "private" || prefs.profileVisibility === "friends" ? prefs.profileVisibility : "public";
    if (me !== u.id && visibility === "private") return OK({ error: "Ten profil jest prywatny" }, { status: 403 });
    if (me !== u.id && visibility === "friends") {
      if (!me) return OK({ error: "Ten profil jest dostępny tylko dla znajomych" }, { status: 403 });
      const friendship = await db.select({ senderId: friendRequests.senderId }).from(friendRequests).where(and(
        eq(friendRequests.status, "accepted"),
        or(and(eq(friendRequests.senderId, me), eq(friendRequests.receiverId, u.id)), and(eq(friendRequests.senderId, u.id), eq(friendRequests.receiverId, me)))
      )).limit(1);
      if (!friendship.length) return OK({ error: "Ten profil jest dostępny tylko dla znajomych" }, { status: 403 });
    }

    const followers = (await db.select({ n: count() }).from(follows).where(eq(follows.followeeId, u.id)))[0]?.n ?? 0;
    const following = (await db.select({ n: count() }).from(follows).where(eq(follows.followerId, u.id)))[0]?.n ?? 0;
    const followedByMe = me
      ? (await db.select({ n: count() }).from(follows).where(and(eq(follows.followerId, me), eq(follows.followeeId, u.id))))[0]?.n
      : 0;

    const presence = prefs.profileShowActivity === false ? [] : await db.select({
      id: tracks.id,
      title: tracks.title,
      artist: tracks.artist,
      cover: tracks.cover,
      updatedAt: listeningPresence.updatedAt,
    }).from(listeningPresence)
      .innerJoin(tracks, eq(listeningPresence.trackId, tracks.id))
      .where(and(
        eq(listeningPresence.userId, u.id),
        gt(listeningPresence.updatedAt, new Date(Date.now() - 120_000))
      )).limit(1);

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
      profileStyle: { theme: prefs.profileTheme ?? "paper", accent: prefs.profileAccent ?? "graphite", showActivity: prefs.profileShowActivity !== false, banner: typeof prefs.profileBanner === "string" ? prefs.profileBanner : "" },
      nowPlaying: presence[0] ? { id: presence[0].id, title: presence[0].title, artist: presence[0].artist, cover: presence[0].cover, updatedAt: presence[0].updatedAt.toISOString() } : null,
    });
  } catch (e) {
    console.error("[users:profile]", e);
    return OK({ error: "Błąd serwera" }, { status: 500 });
  }
}
