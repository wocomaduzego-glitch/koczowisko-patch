import { NextResponse } from "next/server";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { db } from "@/db";
import { contentReports, moderationActions, users, tracks, playlistTracks } from "@/db/schema";
import { and, count, desc, eq } from "drizzle-orm";
import { currentUserId } from "@/lib/auth";
import { requireCreatorAdmin } from "@/lib/permissions";

const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
export async function GET() {
  try {
    const me = await currentUserId();
    if (!(await requireCreatorAdmin(me))) return json({ error: "Brak uprawnień administratora" }, 403);
    const [people, reports, actions, libraryRows, playlistUsage] = await Promise.all([
      db.select({ id: users.id, username: users.username, displayName: users.displayName, accountStatus: users.accountStatus, suspendedUntil: users.suspendedUntil, createdAt: users.createdAt }).from(users).orderBy(desc(users.createdAt)).limit(300),
      db.select().from(contentReports).orderBy(desc(contentReports.createdAt)).limit(300),
      db.select().from(moderationActions).orderBy(desc(moderationActions.createdAt)).limit(100),
      db.select({ id: tracks.id, title: tracks.title, artist: tracks.artist, path: tracks.path, cover: tracks.cover, createdAt: tracks.createdAt }).from(tracks).orderBy(desc(tracks.createdAt)).limit(500),
      db.select({ trackId: playlistTracks.trackId, used: count() }).from(playlistTracks).groupBy(playlistTracks.trackId),
    ]);
    const usage = new Map(playlistUsage.map(row => [row.trackId, Number(row.used)]));
    return json({
      users: people.map(u => ({ ...u, createdAt: u.createdAt.toISOString(), suspendedUntil: u.suspendedUntil?.toISOString() ?? null })),
      reports: reports.map(r => ({ ...r, createdAt: r.createdAt.toISOString(), reviewedAt: r.reviewedAt?.toISOString() ?? null })),
      actions: actions.map(a => ({ ...a, createdAt: a.createdAt.toISOString(), expiresAt: a.expiresAt?.toISOString() ?? null })),
      library: libraryRows.map(t => ({ id: t.id, title: t.title, artist: t.artist, playlists: usage.get(t.id) ?? 0, createdAt: t.createdAt.toISOString() })),
    });
  } catch (e) { console.error("[admin:get]", e); return json({ error: "Błąd serwera" }, 500); }
}
export async function POST(req: Request) {
  try {
    const me = await currentUserId();
    if (!(await requireCreatorAdmin(me))) return json({ error: "Brak uprawnień administratora" }, 403);
    const body = await req.json();
    const action = String(body.action || "");
    if (action === "delete-track") {
      const trackId = String(body.trackId || "");
      if (!trackId) return json({ error: "Brak identyfikatora utworu" }, 400);
      const track = (await db.select().from(tracks).where(eq(tracks.id, trackId)).limit(1))[0];
      if (!track) return json({ error: "Nie znaleziono utworu" }, 404);
      const uploadRoot = path.resolve(process.cwd(), "uploads");
      const audioPath = path.resolve(uploadRoot, track.path);
      if (!audioPath.startsWith(uploadRoot + path.sep)) return json({ error: "Nieprawidłowa ścieżka pliku" }, 400);
      await db.delete(tracks).where(eq(tracks.id, trackId));
      try { await unlink(audioPath); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") console.error("[admin:delete-track:file]", error); }
      const coverMatch = track.cover?.match(/^\/api\/files\/covers\/([a-zA-Z0-9._-]+)$/);
      if (coverMatch) {
        const coverPath = path.resolve(uploadRoot, "covers", coverMatch[1]);
        if (coverPath.startsWith(path.resolve(uploadRoot, "covers") + path.sep)) {
          try { await unlink(coverPath); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") console.error("[admin:delete-track:cover]", error); }
        }
      }
      return json({ ok: true });
    }
    if (action === "review-report") {
      const reportId = String(body.reportId || "");
      const status = String(body.status || "");
      if (!["reviewed", "dismissed"].includes(status)) return json({ error: "Nieprawidłowy status" }, 400);
      const changed = await db.update(contentReports).set({ status, reviewedBy: me, reviewedAt: new Date() }).where(and(eq(contentReports.id, reportId), eq(contentReports.status, "open"))).returning();
      if (!changed.length) return json({ error: "Zgłoszenie nie istnieje lub zostało już rozpatrzone" }, 404);
      return json({ ok: true });
    }
    if (action === "suspend" || action === "unsuspend") {
      const targetUserId = String(body.userId || "");
      const reason = String(body.reason || "").trim();
      const minutes = Math.max(0, Math.min(43200, Number(body.minutes || 0)));
      if (!targetUserId || targetUserId === me || (action === "suspend" && reason.length < 5)) return json({ error: "Nieprawidłowe dane blokady" }, 400);
      const target = (await db.select().from(users).where(eq(users.id, targetUserId)).limit(1))[0];
      if (!target) return json({ error: "Nie znaleziono użytkownika" }, 404);
      if (target.id && (await requireCreatorAdmin(target.id))) return json({ error: "Nie można zawiesić konta twórcy Koczowiska" }, 403);
      const until = action === "suspend" && minutes > 0 ? new Date(Date.now() + minutes * 60000) : null;
      await db.update(users).set({ accountStatus: action === "suspend" ? (until ? "active" : "suspended") : "active", suspendedUntil: until }).where(eq(users.id, targetUserId));
      await db.insert(moderationActions).values({ moderatorId: me, targetUserId, action, reason: reason || "Cofnięto blokadę", expiresAt: until });
      return json({ ok: true });
    }
    return json({ error: "Nieznana akcja" }, 400);
  } catch (e) { console.error("[admin:post]", e); return json({ error: "Błąd serwera" }, 500); }
}
