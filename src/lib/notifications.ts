import { db } from "@/db";
import { notifications } from "@/db/schema";

export async function createNotification(input: {
  userId: string;
  actorId?: string | null;
  type: string;
  title: string;
  body: string;
  href?: string | null;
}) {
  if (!input.userId || input.userId === input.actorId) return;
  await db.insert(notifications).values({
    userId: input.userId,
    actorId: input.actorId ?? null,
    type: input.type,
    title: input.title,
    body: input.body,
    href: input.href ?? null,
  });
}
