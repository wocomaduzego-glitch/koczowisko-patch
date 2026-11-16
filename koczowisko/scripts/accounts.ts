import "dotenv/config";
import { db, pool } from "../src/db";
import * as schema from "../src/db/schema";
import { count } from "drizzle-orm";
import { deleteAccountData } from "../src/lib/account-data";

async function main() {
  const tables = {
    users: schema.users, sessions: schema.sessions, groups: schema.groups, groupMembers: schema.groupMembers,
    groupPosts: schema.groupPosts, groupPlaylists: schema.groupPlaylists,
    tracks: schema.tracks, playlists: schema.playlists, playlistTracks: schema.playlistTracks,
    comments: schema.comments, follows: schema.follows, settings: schema.settings,
    lyrics: schema.lyrics, listens: schema.listens, trackLikes: schema.trackLikes, playlistLikes: schema.playlistLikes,
  };
  if (process.argv.includes("--delete-all-accounts")) {
    // Explicit command only. Never called from an API, page render, build or app startup.
    const accounts = await db.select({ id: schema.users.id }).from(schema.users);
    for (const account of accounts) await deleteAccountData(account.id);
    console.log(`Usunięto kont: ${accounts.length}. Powiązane sesje i dane usunięte kaskadowo. Znak marki bez zmian.`);
  }
  const result: Record<string, number> = {};
  for (const [name, table] of Object.entries(tables)) result[name] = (await db.select({ total: count() }).from(table))[0].total;
  console.log(JSON.stringify(result, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => pool.end());
