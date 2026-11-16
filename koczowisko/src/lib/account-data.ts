import { db } from "@/db";
import { lyrics, playlists, tracks, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { unlink } from "node:fs/promises";
import path from "node:path";

/** Used by account deletion and by the explicit, one-time maintenance command. */
export async function deleteAccountData(userId: string) {
  const account = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
  if (!account) return false;
  const audio = await db.select().from(tracks).where(eq(tracks.addedBy, userId));
  const ownedLists = await db.select({ cover: playlists.cover }).from(playlists).where(eq(playlists.ownerId, userId));
  await db.transaction(async (tx) => {
    await tx.delete(lyrics).where(eq(lyrics.authorId, userId));
    await tx.delete(tracks).where(eq(tracks.addedBy, userId));
    // FK cascades: sessions, groups, memberships, posts, lists, comments, likes, settings, history.
    await tx.delete(users).where(eq(users.id, userId));
  });
  const root = path.resolve(process.cwd(), "uploads");
  const files = new Set<string>();
  for (const t of audio) files.add(t.path);
  for (const image of [account.avatar, ...audio.map((t) => t.cover), ...ownedLists.map((p) => p.cover)]) {
    if (image?.startsWith("/api/files/")) files.add(image.slice("/api/files/".length));
  }
  for (const relative of files) {
    const target = path.resolve(root, relative);
    if (!target.startsWith(root + path.sep) || relative.startsWith("brand/")) continue;
    await unlink(target).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") console.error("[account-file-removal]", error.code);
    });
  }
  return true;
}
