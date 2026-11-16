import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { getSettings, saveSettings } from "@/lib/api";

const ALLOWED = ["accent", "animations", "autoplayNext", "resumePosition", "autoSync", "social"];

export async function GET() {
  try {
    const me = await currentUserId();
    if (!me) return NextResponse.json({ error: "Zaloguj się" }, { status: 401 });
    return NextResponse.json({ settings: await getSettings(me) });
  } catch (e) {
    console.error("[settings:get]", e);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const me = await currentUserId();
    if (!me) return NextResponse.json({ error: "Zaloguj się" }, { status: 401 });
    const body = await req.json();
    const clean: Record<string, unknown> = {};
    for (const key of ALLOWED) {
      if (body[key] !== undefined) clean[key] = body[key];
    }
    return NextResponse.json({ settings: await saveSettings(me, clean) });
  } catch (e) {
    console.error("[settings:put]", e);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }
}
