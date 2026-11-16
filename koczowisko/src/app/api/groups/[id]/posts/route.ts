import { NextResponse } from "next/server";
import { db } from "@/db";
import { groupMembers, groupPosts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { currentUserId } from "@/lib/auth";
import { groupDetail } from "@/lib/api";

const OK = NextResponse.json;
type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  try {
    const me = await currentUserId();
    if (!me) return OK({ error: "Zaloguj się" }, { status: 401 });
    const { id } = await params;
    const body = await req.json();
    const text = String(body.body || "").trim();
    if (!text || text.length > 500) return OK({ error: "Post: 1–500 znaków" }, { status: 400 });
    const membership = (await db.select().from(groupMembers).where(eq(groupMembers.groupId, id)).limit(500)).find((m) => m.userId === me);
    if (!membership) return OK({ error: "Najpierw dołącz do grupy" }, { status: 403 });
    await db.insert(groupPosts).values({ groupId: id, userId: me, body: text });
    const g = await groupDetail(id, me);
    return OK({ group: g });
  } catch (e) {
    console.error("[group:posts]", e);
    return OK({ error: "Błąd serwera" }, { status: 500 });
  }
}
