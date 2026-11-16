import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { computeStats } from "@/lib/api";

export async function GET() {
  try {
    const me = await currentUserId();
    if (!me) return NextResponse.json({ error: "Zaloguj się" }, { status: 401 });
    return NextResponse.json({ stats: await computeStats(me) });
  } catch (e) {
    console.error("[stats]", e);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }
}
