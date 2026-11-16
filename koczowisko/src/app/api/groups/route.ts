import { NextResponse } from "next/server";
import { db } from "@/db";
import { groupMembers, groups } from "@/db/schema";
import { currentUserId } from "@/lib/auth";
import { listGroups } from "@/lib/api";

const OK = NextResponse.json;

export async function GET() {
  try {
    const me = await currentUserId();
    return OK({ groups: await listGroups(me) });
  } catch (e) {
    console.error("[groups]", e);
    return OK({ error: "Błąd serwera" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const me = await currentUserId();
    if (!me) return OK({ error: "Zaloguj się" }, { status: 401 });
    const body = await req.json();
    const name = String(body.name || "").trim();
    if (!name || name.length > 40) return OK({ error: "Nazwa grupy: 1–40 znaków" }, { status: 400 });
    const rows = await db
      .insert(groups)
      .values({ name, description: String(body.description || "").trim().slice(0, 200), ownerId: me })
      .returning();
    await db.insert(groupMembers).values({ groupId: rows[0].id, userId: me, role: "owner" });
    return OK({ group: (await listGroups(me)).find((g) => g.id === rows[0].id) });
  } catch (e) {
    console.error("[groups:create]", e);
    return OK({ error: "Błąd serwera" }, { status: 500 });
  }
}
