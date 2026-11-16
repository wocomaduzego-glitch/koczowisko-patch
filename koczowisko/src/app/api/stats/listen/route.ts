import { NextResponse } from "next/server";
import { db } from "@/db";
import { listens, tracks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { currentUserId } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const me = await currentUserId();
    if (!me) return NextResponse.json({ ok: false }, { status: 401 });
    const body = await req.json();
    const trackId = String(body.trackId || "");
    const seconds = Math.min(3600, Math.max(0, Math.round(Number(body.seconds) || 0)));
    if (!trackId || seconds <= 0) return NextResponse.json({ ok: false });
    const t = (await db.select({ id: tracks.id }).from(tracks).where(eq(tracks.id, trackId)).limit(1))[0];
    if (!t) return NextResponse.json({ ok: false });
    let startedAt: Date = new Date();
    if (body.startedAt) {
      const d = new Date(body.startedAt);
      if (!isNaN(d.getTime()) && d.getTime() > Date.now() - 7 * 86400 * 1000) startedAt = d;
    }
    await db.insert(listens).values({ userId: me, trackId, startedAt, seconds });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[stats:listen]", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
