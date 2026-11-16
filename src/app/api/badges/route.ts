import { NextResponse } from "next/server";
import { currentUserId, getUserByUsername } from "@/lib/auth";
import { requireCreatorAdmin } from "@/lib/permissions";
import {
  BADGE_CATALOG,
  badgesForUser,
  grantBadge,
  isBadgeKey,
  recordPasswordAttempt,
  revokeBadge,
  syncAutomaticBadges,
  tooManyPasswordAttempts,
  verifyBadgePassword,
} from "@/lib/badges";

export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });

const normalizeUsername = (value: unknown) =>
  String(value ?? "").trim().toLowerCase().replace(/^@/, "");

export async function GET(req: Request) {
  try {
    const me = await currentUserId();
    const requestedUsername = normalizeUsername(new URL(req.url).searchParams.get("username"));

    let targetId = me;
    let targetUsername: string | null = null;

    if (requestedUsername) {
      const target = await getUserByUsername(requestedUsername);
      if (!target) return json({ error: `Nie ma użytkownika @${requestedUsername}` }, 404);
      targetId = target.id;
      targetUsername = target.username;
    }

    if (targetId) await syncAutomaticBadges(targetId);

    const [badges, mine] = await Promise.all([
      targetId ? badgesForUser(targetId) : Promise.resolve([]),
      me ? badgesForUser(me) : Promise.resolve([]),
    ]);

    return json({
      catalog: BADGE_CATALOG,
      badges,
      targetBadges: badges,
      mine,
      username: targetUsername,
      targetUsername,
      signedIn: Boolean(me),
    });
  } catch (error) {
    console.error("[badges:get]", error);
    return json({ error: "Nie można wczytać odznak" }, 500);
  }
}

export async function POST(req: Request) {
  try {
    const me = await currentUserId();
    const client = (req.headers.get("x-forwarded-for") || "local").split(",")[0].trim();

    if (tooManyPasswordAttempts(client)) {
      return json({ error: "Zbyt wiele prób. Odczekaj kilka minut." }, 429);
    }

    const body = await req.json();
    const password = String(body.password ?? "");
    const action = String(body.action ?? "unlock");

    if (!verifyBadgePassword(password)) {
      recordPasswordAttempt(client, false);
      return json({ error: "Nieprawidłowe hasło do odznak lub brak konfiguracji hasła" }, 401);
    }
    recordPasswordAttempt(client, true);

    if (action === "unlock") return json({ ok: true, catalog: BADGE_CATALOG });
    if (!me) return json({ error: "Zaloguj się, aby nadać odznakę" }, 401);

    const badge = String(body.badge ?? "");
    if (!isBadgeKey(badge)) return json({ error: "Nieznana odznaka" }, 400);

    const requestedUsername = normalizeUsername(body.username);
    let targetId = me;
    let targetUsername: string | null = null;

    if (requestedUsername) {
      const target = await getUserByUsername(requestedUsername);
      if (!target) return json({ error: `Nie ma użytkownika @${requestedUsername}` }, 404);
      targetId = target.id;
      targetUsername = target.username;
    }

    if (badge === "tworcy") {
      const admin = await requireCreatorAdmin(me);
      if (action === "add" && targetId !== me && !admin) {
        return json({ error: "Tylko administrator może nadać odznakę Twórcy innej osobie" }, 403);
      }
      if (action === "remove" && (!admin || targetId === me)) {
        return json({ error: "Odznakę Twórcy może odebrać tylko inny administrator" }, 403);
      }
    }

    let message = "";
    if (action === "add") {
      const result = await grantBadge(targetId, badge, me);
      const name = BADGE_CATALOG.find((item) => item.key === badge)?.name ?? badge;
      message = result.granted
        ? `Nadano odznakę ${name}${targetUsername ? ` dla @${targetUsername}` : ""}`
        : "Ta osoba ma już tę odznakę";
    } else if (action === "remove") {
      await revokeBadge(targetId, badge);
      message = "Odznaka usunięta";
    } else {
      return json({ error: "Nieznana akcja" }, 400);
    }

    const [mine, targetBadges] = await Promise.all([
      badgesForUser(me),
      badgesForUser(targetId),
    ]);

    return json({
      ok: true,
      message,
      mine,
      targetBadges,
      username: targetUsername,
      targetUsername,
    });
  } catch (error) {
    console.error("[badges:post]", error);
    return json({ error: "Nie udało się zapisać odznaki" }, 500);
  }
}
