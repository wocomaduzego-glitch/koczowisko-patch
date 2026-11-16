import type {
  AppSettings,
  CommentItem,
  GroupDetail,
  GroupLite,
  LyricsDoc,
  Playlist,
  StatsData,
  Track,
  UserLite,
} from "./types";
import { DEFAULT_SETTINGS } from "./types";
import { getUserById, publicUser } from "./auth";
import {
  comments,
  follows,
  groupMembers,
  groupPlaylists,
  groupPosts,
  groups,
  listens,
  lyrics,
  playlistLikes,
  playlistTracks,
  playlists,
  settings,
  trackLikes,
  tracks,
  users,
} from "@/db/schema";
import { db } from "@/db";
import { badgesForUsers } from "./badges";
import { and, asc, count, desc, eq, inArray, or, sql } from "drizzle-orm";

/* ---------------- shared query builders ---------------- */

export async function listTracks(search?: string, likedBy?: string | null): Promise<Track[]> {
  const where = search
    ? or(
        sql`lower(${tracks.title}) like ${`%${search.toLowerCase()}%`}`,
        sql`lower(${tracks.artist}) like ${`%${search.toLowerCase()}%`}`,
        sql`lower(${tracks.album}) like ${`%${search.toLowerCase()}%`}`
      )
    : undefined;
  const rows = await db
    .select()
    .from(tracks)
    .where(where)
    .orderBy(asc(tracks.createdAt));
  const ids = rows.map((r) => r.id);
  const likeRows = ids.length
    ? await db
        .select({ trackId: trackLikes.trackId, n: count() })
        .from(trackLikes)
        .where(inArray(trackLikes.trackId, ids))
        .groupBy(trackLikes.trackId)
    : [];
  const likeMap = new Map(likeRows.map((r) => [r.trackId, r.n]));
  const myLikes = likedBy && ids.length
    ? new Set(
        (await db.select({ trackId: trackLikes.trackId }).from(trackLikes).where(eq(trackLikes.userId, likedBy))).map((r) => r.trackId)
      )
    : new Set<string>();
  const lyricTracks = new Set(
    (await db.select({ trackId: lyrics.trackId }).from(lyrics)).map((r) => r.trackId)
  );
  const commentRows = ids.length
    ? await db
        .select({ trackId: comments.trackId, n: count() })
        .from(comments)
        .where(inArray(comments.trackId, ids))
        .groupBy(comments.trackId)
    : [];
  const commentMap = new Map(commentRows.map((r) => [r.trackId, r.n]));
  return rows.map((t) => ({
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
    likes: likeMap.get(t.id) ?? 0,
    liked: myLikes.has(t.id),
    hasLyrics: lyricTracks.has(t.id),
    commentCount: commentMap.get(t.id) ?? 0,
    createdAt: t.createdAt.toISOString(),
  }));
}

export function trackToApi(t: (typeof tracks.$inferSelect), likedBy?: string | null): Track {
  return {
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
  };
}

export async function playlistToApi(p: (typeof playlists.$inferSelect), me: string | null): Promise<Playlist> {
  const owner = await getUserById(p.ownerId);
  const pts = await db
    .select({ trackId: playlistTracks.trackId, position: playlistTracks.position })
    .from(playlistTracks)
    .where(eq(playlistTracks.playlistId, p.id))
    .orderBy(asc(playlistTracks.position));
  const trackIds = pts.map((r) => r.trackId);
  const trackRows = trackIds.length
    ? await db.select().from(tracks).where(inArray(tracks.id, trackIds))
    : [];
  const byId = new Map(trackRows.map((t) => [t.id, t]));
  let totalDuration = 0;
  const ordered: Track[] = [];
  for (const r of pts) {
    const t = byId.get(r.trackId);
    if (!t) continue;
    const api = trackToApi(t, me);
    api.addedByName = t.addedBy ? (await getUserById(t.addedBy))?.displayName ?? null : null;
    ordered.push(api);
    totalDuration += api.duration;
  }
  const likeCount = (await db.select({ n: count() }).from(playlistLikes).where(eq(playlistLikes.playlistId, p.id)))[0]?.n ?? 0;
  const liked = me
    ? (await db.select({ n: count() }).from(playlistLikes).where(and(eq(playlistLikes.playlistId, p.id), eq(playlistLikes.userId, me))))[0]?.n
    : 0;
  return {
    id: p.id,
    ownerId: p.ownerId,
    ownerName: owner?.displayName ?? "Nieznany",
    name: p.name,
    description: p.description ?? "",
    cover: p.cover,
    isPrivate: !!p.isPrivate,
    kind: "normal",
    tracks: ordered,
    totalDuration,
    likes: likeCount,
    liked: !!liked,
    isOwner: me === p.ownerId,
    createdAt: p.createdAt.toISOString(),
  };
}

export async function fetchMyPlaylists(me: string): Promise<Playlist[]> {
  const rows = await db.select().from(playlists).where(eq(playlists.ownerId, me)).orderBy(asc(playlists.createdAt));
  const out: Playlist[] = [];
  for (const p of rows) out.push(await playlistToApi(p, me));
  return out;
}

export async function fetchPublicPlaylists(me: string | null): Promise<Playlist[]> {
  const rows = await db.select().from(playlists).where(eq(playlists.isPrivate, false)).orderBy(desc(playlists.createdAt));
  const out: Playlist[] = [];
  for (const p of rows) out.push(await playlistToApi(p, me));
  return out;
}

export async function fetchTracksWithNames(list: Track[], me: string | null): Promise<Track[]> {
  const idSet = new Set(list.map((t) => t.id));
  const likeRows = (
    await db.select({ trackId: trackLikes.trackId, n: count() }).from(trackLikes).groupBy(trackLikes.trackId)
  ).filter((r) => idSet.has(r.trackId));
  const likeMap = new Map(likeRows.map((r) => [r.trackId, r.n]));
  const myLikes = me
    ? new Set((await db.select({ trackId: trackLikes.trackId }).from(trackLikes).where(eq(trackLikes.userId, me))).map((r) => r.trackId))
    : new Set<string>();
  const lyricRows = new Set((await db.select({ trackId: lyrics.trackId }).from(lyrics)).map((r) => r.trackId));
  const commRows = (await db.select({ trackId: comments.trackId, n: count() }).from(comments).groupBy(comments.trackId)).filter((r) => idSet.has(r.trackId));
  const commMap = new Map(commRows.map((r) => [r.trackId, r.n]));
  for (const t of list) {
    t.likes = likeMap.get(t.id) ?? 0;
    t.liked = myLikes.has(t.id);
    t.hasLyrics = lyricRows.has(t.id);
    t.commentCount = commMap.get(t.id) ?? 0;
    if (t.addedBy) {
      const u = await getUserById(t.addedBy);
      t.addedByName = u?.displayName ?? null;
    }
  }
  return list;
}

/* ---------------- settings ---------------- */

export async function getSettings(me: string): Promise<AppSettings> {
  const row = (await db.select().from(settings).where(eq(settings.userId, me)))[0];
  return { ...DEFAULT_SETTINGS, ...(row?.data ?? {}) } as AppSettings;
}

export async function saveSettings(me: string, data: Record<string, unknown>): Promise<AppSettings> {
  const current = await getSettings(me);
  const merged = { ...current, ...data };
  await db
    .insert(settings)
    .values({ userId: me, data: merged })
    .onConflictDoUpdate({ target: settings.userId, set: { data: merged } });
  return merged;
}

/* ---------------- stats helpers ---------------- */

export async function computeStats(me: string): Promise<StatsData> {
  const listensRows = await db
    .select({
      trackId: listens.trackId,
      startedAt: listens.startedAt,
      seconds: listens.seconds,
    })
    .from(listens)
    .where(eq(listens.userId, me));

  const trackIds = [...new Set(listensRows.map((r) => r.trackId))];
  const trackRows = trackIds.length ? await db.select().from(tracks).where(inArray(tracks.id, trackIds)) : [];
  const trackMap = new Map(trackRows.map((t) => [t.id, t]));

  let totalSeconds = 0;
  let totalPlays = 0;
  const perTrack = new Map<string, { seconds: number; plays: number }>();
  const perArtist = new Map<string, number>();
  const perDay = new Map<string, number>();
  const days = new Set<string>();

  for (const r of listensRows) {
    totalSeconds += r.seconds;
    totalPlays++;
    const t = trackMap.get(r.trackId);
    const key = r.startedAt.toISOString().slice(0, 10);
    days.add(key);
    perDay.set(key, (perDay.get(key) ?? 0) + r.seconds);
    const pt = perTrack.get(r.trackId) ?? { seconds: 0, plays: 0 };
    pt.seconds += r.seconds;
    pt.plays++;
    perTrack.set(r.trackId, pt);
    if (t) perArtist.set(t.artist, (perArtist.get(t.artist) ?? 0) + r.seconds);
  }

  const trackApi = (id: string): Track => {
    const t = trackMap.get(id)!;
    return trackToApi(t, me);
  };

  const topTracks = [...perTrack.entries()]
    .sort((a, b) => b[1].seconds - a[1].seconds)
    .slice(0, 8)
    .map(([id, v]) => ({ track: trackApi(id), seconds: v.seconds, plays: v.plays }));

  const topArtists = [...perArtist.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([artist, seconds]) => ({ artist, seconds }));

  const myPl = await fetchMyPlaylists(me);
  const topPlaylists = [...myPl].sort((a, b) => b.likes - a.likes || b.tracks.length - a.tracks.length).slice(0, 5)
    .map((playlist) => ({ playlist, likes: playlist.likes }));

  const daily: { date: string; seconds: number }[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    daily.push({ date: key, seconds: perDay.get(key) ?? 0 });
  }

  const activity = [...listensRows]
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
    .slice(0, 15)
    .filter((r) => trackMap.has(r.trackId))
    .map((r) => ({ track: trackApi(r.trackId), at: r.startedAt.toISOString(), seconds: r.seconds }));

  return {
    totalSeconds,
    totalPlays,
    uniqueTracks: trackIds.length,
    activeDays: days.size,
    topTracks,
    topArtists,
    topPlaylists,
    daily,
    activity,
  };
}

/* ---------------- groups helpers ---------------- */

export async function listGroups(me: string | null): Promise<GroupLite[]> {
  const gRows = await db.select().from(groups).orderBy(desc(groups.createdAt));
  const out: GroupLite[] = [];
  for (const g of gRows) {
    const memberRows = await db.select().from(groupMembers).where(eq(groupMembers.groupId, g.id));
    const postRows = (await db.select({ n: count() }).from(groupPosts).where(eq(groupPosts.groupId, g.id)))[0]?.n ?? 0;
    const owner = await getUserById(g.ownerId);
    out.push({
      id: g.id,
      name: g.name,
      description: g.description ?? "",
      ownerName: owner?.displayName ?? "?",
      memberCount: memberRows.length,
      postCount: postRows,
      isMember: me ? memberRows.some((m) => m.userId === me) : false,
    });
  }
  return out;
}

export async function groupDetail(gid: string, me: string | null): Promise<GroupDetail | null> {
  const g = (await db.select().from(groups).where(eq(groups.id, gid)))[0];
  if (!g) return null;
  const memberRows = await db.select().from(groupMembers).where(eq(groupMembers.groupId, g.id));
  const postRows = await db
    .select()
    .from(groupPosts)
    .where(eq(groupPosts.groupId, g.id))
    .orderBy(desc(groupPosts.createdAt));
  const badgeMap = await badgesForUsers([...memberRows.map((m) => m.userId), ...postRows.map((p) => p.userId)]);
  const members = [];
  for (const m of memberRows) {
    const u = await getUserById(m.userId);
    if (u) members.push({ user: { ...publicUser(u), badges: badgeMap.get(u.id) ?? [] }, role: m.role ?? "member" });
  }
  const posts = [];
  for (const p of postRows) {
    const u = await getUserById(p.userId);
    if (u) posts.push({ id: p.id, body: p.body, createdAt: p.createdAt.toISOString(), user: { ...publicUser(u), badges: badgeMap.get(u.id) ?? [] } });
  }
  const plRows = await db.select().from(groupPlaylists).where(eq(groupPlaylists.groupId, g.id));
  const pIds = plRows.map((r) => r.playlistId);
  const plList = pIds.length ? await db.select().from(playlists).where(and(inArray(playlists.id, pIds), me ? or(eq(playlists.isPrivate, false), eq(playlists.ownerId, me)) : eq(playlists.isPrivate, false))) : [];
  const pls = [];
  for (const p of plList) pls.push(await playlistToApi(p, me));
  const owner = await getUserById(g.ownerId);
  return {
    id: g.id,
    name: g.name,
    description: g.description ?? "",
    ownerName: owner?.displayName ?? "?",
    memberCount: members.length,
    postCount: posts.length,
    isMember: me ? memberRows.some((m) => m.userId === me) : false,
    members,
    posts,
    playlists: pls,
  };
}

/* ---------------- comments helpers ---------------- */

export async function commentsForTrack(trackId: string): Promise<CommentItem[]> {
  const rows = await db.select().from(comments).where(eq(comments.trackId, trackId)).orderBy(asc(comments.createdAt));
  const badgeMap = await badgesForUsers(rows.map((row) => row.userId));
  const top = rows.filter((r) => !r.parentId);
  const out: CommentItem[] = [];
  for (const c of top) {
    const u = await getUserById(c.userId);
    if (!u) continue;
    const item: CommentItem = {
      id: c.id,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      user: { ...publicUser(u), badges: badgeMap.get(u.id) ?? [] },
      replies: [],
    };
    for (const r of rows.filter((rr) => rr.parentId === c.id)) {
      const ru = await getUserById(r.userId);
      if (!ru) continue;
      item.replies.push({ id: r.id, body: r.body, createdAt: r.createdAt.toISOString(), user: { ...publicUser(ru), badges: badgeMap.get(ru.id) ?? [] }, replies: [] });
    }
    out.push(item);
  }
  return out;
}

export type { CommentItem, GroupDetail, GroupLite };
