import { NextResponse } from "next/server";
import { db } from "@/db";
import { groupMembers, groups } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { currentUserId } from "@/lib/auth";
import { groupDetail } from "@/lib/api";

const OK = NextResponse.json;
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const me = await currentUserId();
    const { id } = await params;
    const g = await groupDetail(id, me);
    if (!g) return OK({ error: "Nie znaleziono grupy" }, { status: 404 });
    return OK({ group: g });
  } catch (e) {
    console.error("[group:detail]", e);
    return OK({ error: "Błąd serwera" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: Ctx) {
  try {
    const me = await currentUserId();
    if (!me) return OK({ error: "Zaloguj się" }, { status: 401 });
    const { id } = await params;
    const body = await req.json();
    const g = (await db.select().from(groups).where(eq(groups.id, id)).limit(1))[0];
    if (!g) return OK({ error: "Nie znaleziono grupy" }, { status: 404 });

    const current = (await db.select().from(groupMembers).where(eq(groupMembers.groupId, id)).limit(500)).find((m) => m.userId === me);

    if (body.action === "join") {
      if (current) return OK({ ok: true });
      await db.insert(groupMembers).values({ groupId: id, userId: me, role: "member" });
    } else if (body.action === "leave") {
      if (!current) return OK({ ok: true });
      if (current.role === "owner" && g.ownerId === me) {
        // właściciel zamyka całą grupę
        await db.delete(groups).where(eq(groups.id, id));
      } else {
        await db
          .delete(groupMembers)
          .where(and(eq(groupMembers.groupId, id), eq(groupMembers.userId, me)));
      }
    } else {
      return OK({ error: "Nieznana akcja" }, { status: 400 });
    }
    const updated = await groupDetail(id, me);
    return OK({ group: updated, deleted: !updated });
  } catch (e) {
    console.error("[group:join]", e);
    return OK({ error: "Błąd serwera" }, { status: 500 });
  }
}
