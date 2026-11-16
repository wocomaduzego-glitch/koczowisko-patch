import { NextResponse } from "next/server";
import { currentUserId, getUserByUsername } from "@/lib/auth";
import { badgesForUser, BADGE_CATALOG, grantBadge, isBadgeKey, recordPasswordAttempt, revokeBadge, tooManyPasswordAttempts, verifyBadgePassword, syncAutomaticBadges } from "@/lib/badges";

export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET(req: Request) {
  try {
    const me = await currentUserId();
    const url = new URL(req.url);
    const requestedUsername = (url.searchParams.get("username") || "").trim().toLowerCase().replace(/^@/, "");
    let targetId = me;
    let targetUsername: string | null = null;
    if (requestedUsername) {
      const target = await getUserByUsername(requestedUsername);
      if (!target) return json({ error: `Nie ma użytkownika @${requestedUsername}` }, 404);
      targetId = target.id;
      targetUsername = target.username;
    }
    if (targetId) await syncAutomaticBadges(targetId);
    const badges = targetId ? await badgesForUser(targetId) : [];
    return json({ catalog: BADGE_CATALOG, badges, mine: badges, username: targetUsername, signedIn: !!me });
  } catch (e) {
    console.error("[badges:get]", e);
    return json({ error: "Nie można wczytać odznak" }, 500);
  }
}

export async function POST(req: Request) {
  try {
    const me = await currentUserId();
    const client = (req.headers.get("x-forwarded-for") || "local").split(",")[0].trim();
    if (tooManyPasswordAttempts(client)) return json({ error: "Zbyt wiele prób. Odczekaj kilka minut." }, 429);
    const body = await req.json();
    const password = String(body.password ?? ""), action = String(body.action ?? "unlock");
    if (!verifyBadgePassword(password)) { recordPasswordAttempt(client, false); return json({ error: "Nieprawidłowe hasło do odznak lub brak konfiguracji hasła" }, 401); }
    recordPasswordAttempt(client, true);
    if (action === "unlock") return json({ ok: true, catalog: BADGE_CATALOG });
    if (!me) return json({ error: "Zaloguj się, aby nadać odznakę" }, 401);
    const badge = String(body.badge ?? "");
    if (!isBadgeKey(badge)) return json({ error: "Nieznana odznaka" }, 400);
    let targetId = me, targetName: string | null = null;
    if (body.username) {
      const username = String(body.username).trim().toLowerCase().replace(/^@/, "");
      const target = await getUserByUsername(username);
      if (!target) return json({ error: `Nie ma użytkownika @${username}` }, 404);
      targetId = target.id; targetName = target.username;
    }
    if (action === "add") {
      const result = await grantBadge(targetId, badge, me);
      return json({ ok: true, granted: result.granted, color: result.color, message: result.granted ? `Nadano odznakę ${BADGE_CATALOG.find((b) => b.key === badge)?.name}${targetName ? ` dla @${targetName}` : ""}` : "Ta osoba ma już tę odznakę", mine: await badgesForUser(me), targetBadges: await badgesForUser(targetId) });
    }
    if (action === "remove") { await revokeBadge(targetId, badge); return json({ ok: true, message: "Odznaka usunięta", mine: await badgesForUser(me), targetBadges: await badgesForUser(targetId) }); }
    return json({ error: "Nieznana akcja" }, 400);
  } catch (e) { console.error("[badges:post]", e); return json({ error: "Nie udało się zapisać odznaki" }, 500); }
}
