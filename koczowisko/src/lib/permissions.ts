import { db } from "@/db";
import { profileBadges } from "@/db/schema";
import { and, eq } from "drizzle-orm";

/** Administrator access is derived only from the protected creator badge. */
export async function isCreatorAdmin(userId: string): Promise<boolean> {
  const row = await db.select({ userId: profileBadges.userId })
    .from(profileBadges)
    .where(and(eq(profileBadges.userId, userId), eq(profileBadges.badge, "tworcy")))
    .limit(1);
  return row.length > 0;
}

export async function requireCreatorAdmin(userId: string | null) {
  return Boolean(userId && await isCreatorAdmin(userId));
}
