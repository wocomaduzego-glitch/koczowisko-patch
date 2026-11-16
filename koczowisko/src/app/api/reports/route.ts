import { NextResponse } from "next/server";
import { db } from "@/db";
import { contentReports } from "@/db/schema";
import { currentUserId } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const me = await currentUserId();
    if (!me) return NextResponse.json({ error: "Zaloguj się, aby zgłosić treść" }, { status: 401 });
    const body = await req.json();
    const targetType = String(body.targetType || "");
    const targetId = String(body.targetId || "");
    const reason = String(body.reason || "").trim();
    if (!["user", "post", "comment", "track", "playlist", "group"].includes(targetType) || !targetId || targetId.length > 100 || reason.length < 5 || reason.length > 500)
      return NextResponse.json({ error: "Podaj prawidłowy typ, identyfikator i powód zgłoszenia (5–500 znaków)" }, { status: 400 });
    const row = (await db.insert(contentReports).values({ reporterId: me, targetType, targetId, reason }).returning())[0];
    return NextResponse.json({ ok: true, reportId: row.id }, { status: 201 });
  } catch (e) { console.error("[reports]", e); return NextResponse.json({ error: "Nie udało się wysłać zgłoszenia" }, { status: 500 }); }
}
