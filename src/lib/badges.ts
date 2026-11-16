
import { randomInt, timingSafeEqual } from "node:crypto";
import { db } from "@/db";
import { profileBadges, tracks, playlists, follows } from "@/db/schema";
import { and, count, eq, inArray } from "drizzle-orm";

/** Katalog odznak Koczowiska. */
export const BADGE_CATALOG = [
  { key: "og", name: "OG", hint: "Ktoś, kto był przy ognisku od samego początku." },
  { key: "tworcy", name: "Twórcy Koczowiska", hint: "Współtwórca aplikacji i społeczności." },
  { key: "kocz", name: "Kocz", hint: "Legenda koczowiska." },
  { key: "dziadzia", name: "Dziadzia", hint: "Starszyzna kręgu." },
  { key: "tester", name: "Tester", hint: "Pomógł testować Koczowisko i zgłaszać błędy." },
  { key: "pierwszy_utwor", name: "Pierwszy utwór", hint: "Dodał swój pierwszy utwór." },
  { key: "kolekcjoner", name: "Kolekcjoner", hint: "Dodał co najmniej 10 utworów." },
  { key: "pierwsza_playlista", name: "Pierwsza playlista", hint: "Utworzył swoją pierwszą playlistę." },
  { key: "popularny", name: "Popularny", hint: "Zdobył co najmniej 10 obserwujących." },
] as const;

export type BadgeKey = (typeof BADGE_CATALOG)[number]["key"];

export const isBadgeKey = (value: string): value is BadgeKey =>
  BADGE_CATALOG.some((badge) => badge.key === value);

export const badgeName = (key: string) =>
  BADGE_CATALOG.find((badge) => badge.key === key)?.name ?? key;

export interface ProfileBadge {
  badge: BadgeKey;
  name: string;
  color: string;
  createdAt: string;
}

export function randomGray(): string {
  const lightness = randomInt(30, 70);
  const saturation = randomInt(0, 7);
  const hue = randomInt(0, 360);
  const s = saturation / 100;
  const l = lightness / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;

  const [r, g, b] =
    hue < 60 ? [c, x, 0] :
    hue < 120 ? [x, c, 0] :
    hue < 180 ? [0, c, x] :
    hue < 240 ? [0, x, c] :
    hue < 300 ? [x, 0, c] :
    [c, 0, x];

  const hex = (value: number) =>
    Math.round((value + m) * 255).toString(16).padStart(2, "0");

  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/** Hasło do nadawania odznak. */
export function verifyBadgePassword(input: string): boolean {
  const expected = process.env.BADGE_ADMIN_PASSWORD;
  if (!expected) return false;
  const a = Buffer.from(input, "utf8");
  const b = Buffer.from(expected, "utf8");

  return a.length === b.length && timingSafeEqual(a, b);
}

function decorate(
  rows: (typeof profileBadges.$inferSelect)[]
): ProfileBadge[] {
  return rows
    .map((row) => ({
      badge: row.badge as BadgeKey,
      name: badgeName(row.badge),
      color: row.color,
      createdAt: row.createdAt.toISOString(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "pl"));
}

export async function badgesForUser(userId: string): Promise<ProfileBadge[]> {
  return decorate(
    await db
      .select()
      .from(profileBadges)
      .where(eq(profileBadges.userId, userId))
  );
}

/** Pobieranie odznak wielu użytkowników. */
export async function badgesForUsers(
  userIds: string[]
): Promise<Map<string, ProfileBadge[]>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  const map = new Map<string, ProfileBadge[]>();

  if (!unique.length) return map;

  const rows = await db
    .select()
    .from(profileBadges)
    .where(inArray(profileBadges.userId, unique));

  for (const userId of unique) map.set(userId, []);

  for (const row of rows) {
    map.get(row.userId)?.push(...decorate([row]));
  }

  for (const list of map.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name, "pl"));
  }

  return map;
}

/** Nadawanie odznaki. */
export async function grantBadge(
  userId: string,
  badge: BadgeKey,
  grantedBy: string | null
) {
  const color = randomGray();

  const inserted = await db
    .insert(profileBadges)
    .values({ userId, badge, color, grantedBy })
    .onConflictDoNothing()
    .returning();

  return inserted[0]
    ? { granted: true, color }
    : { granted: false, color: null };
}

/** Usuwanie odznaki wyłącznie wskazanemu użytkownikowi. */
export async function revokeBadge(userId: string, badge: BadgeKey) {
  const removed = await db
    .delete(profileBadges)
    .where(
      and(
        eq(profileBadges.userId, userId),
        eq(profileBadges.badge, badge)
      )
    )
    .returning();

  return removed.length > 0;
}

/** Automatyczne przyznawanie odznak za aktywność. */
export async function syncAutomaticBadges(userId: string) {
  const [trackResult] = await db
    .select({ value: count() })
    .from(tracks)
    .where(eq(tracks.addedBy, userId));

  const [playlistResult] = await db
    .select({ value: count() })
    .from(playlists)
    .where(eq(playlists.ownerId, userId));

  const [followerResult] = await db
    .select({ value: count() })
    .from(follows)
    .where(eq(follows.followeeId, userId));

  const trackCount = Number(trackResult?.value ?? 0);
  const playlistCount = Number(playlistResult?.value ?? 0);
  const followerCount = Number(followerResult?.value ?? 0);

  const automaticBadges: BadgeKey[] = [];

  if (trackCount >= 1) automaticBadges.push("pierwszy_utwor");
  if (trackCount >= 10) automaticBadges.push("kolekcjoner");
  if (playlistCount >= 1) automaticBadges.push("pierwsza_playlista");
  if (followerCount >= 10) automaticBadges.push("popularny");

  for (const badge of automaticBadges) {
    await grantBadge(userId, badge, null);
  }
}

/** Ograniczenie liczby nieudanych prób wpisania hasła. */
const attempts = new Map<string, { count: number; first: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;

export function tooManyPasswordAttempts(client: string): boolean {
  const entry = attempts.get(client);

  if (!entry) return false;

  if (Date.now() - entry.first > WINDOW_MS) {
    attempts.delete(client);
    return false;
  }

  return entry.count >= MAX_ATTEMPTS;
}

export function recordPasswordAttempt(client: string, ok: boolean) {
  if (ok) {
    attempts.delete(client);
    return;
  }

  const entry = attempts.get(client);

  if (!entry || Date.now() - entry.first > WINDOW_MS) {
    attempts.set(client, { count: 1, first: Date.now() });
  } else {
    entry.count++;
  }
}
