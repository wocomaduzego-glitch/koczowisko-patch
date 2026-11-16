import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { audioFixtures } from "./test-audio.mjs";

const BASE = process.env.BASE || "http://127.0.0.1:3000";
const stamp = randomUUID().replaceAll("-", "").slice(0, 10);
const password = "WebTest!4829";
const identities = ["a", "b"].map((x) => ({ username: `api_${x}_${stamp}`, email: `api_${x}_${stamp}@example.invalid`, password, displayName: `Test API ${x}` }));
let checks = 0;
function ok(message, condition) { assert.ok(condition, message); checks++; console.log(`PASS ${message}`); }
function client() {
  return {
    token: "", cookie: "", setCookie: "",
    async call(url, { method = "GET", json, form, raw = false, headers = {} } = {}) {
      if (this.token) headers.Authorization = `Bearer ${this.token}`;
      if (this.cookie) headers.Cookie = this.cookie;
      if (json) headers["Content-Type"] = "application/json";
      const response = await fetch(BASE + url, { method, headers, body: form || (json ? JSON.stringify(json) : undefined) });
      const setCookie = response.headers.get("set-cookie");
      if (setCookie) { this.setCookie = setCookie; this.cookie = setCookie.split(";")[0]; }
      return { status: response.status, headers: response.headers, data: raw ? Buffer.from(await response.arrayBuffer()) : await response.json() };
    },
  };
}
const anon = client(), A = client(), B = client();
const call = (c, url, json, method = "POST") => c.call(url, { method, json });
try {
  ok("healthcheck", (await anon.call("/api/health")).status === 200);
  const manifest = await anon.call("/manifest.webmanifest");
  ok("manifest przeglądarkowy prowadzi do /web", manifest.data.start_url === "/web");
  if (process.argv.includes("--expect-empty")) {
    for (const route of ["tracks", "groups", "playlists"]) ok(`pusta kolekcja ${route}`, (await anon.call(`/api/${route}`)).data[route].length === 0);
  }
  for (const [index, c] of [A, B].entries()) {
    const r = await call(c, "/api/auth", { action: "register", ...identities[index] });
    ok(`rejestracja ${index + 1}`, r.status === 200 && !!r.data.user?.id && !!r.data.token);
    c.token = r.data.token;
  }
  ok("ciasteczko HttpOnly i 180 dni", /httponly/i.test(A.setCookie) && /max-age=15552000/i.test(A.setCookie));
  const cookieOnly = client(); cookieOnly.cookie = A.cookie;
  ok("sesja przez samo ciasteczko", (await cookieOnly.call("/api/auth")).data.user.username === identities[0].username);
  A.cookie = "";
  ok("sesja przez sam token", (await A.call("/api/auth")).data.user.username === identities[0].username);
  const altered = client(); altered.token = A.token.slice(0,-1) + (A.token.endsWith("a") ? "b" : "a");
  ok("podrobiony token odrzucony", (await altered.call("/api/auth")).data.user === null);
  ok("złe hasło odrzucone", (await call(anon, "/api/auth", { action: "login", username: identities[0].username, password: "bad" })).status === 401);
  ok("brak loginu odrzucony", (await call(anon, "/api/auth", { action: "login", password })).status === 400);
  ok("duplikat konta odrzucony", (await call(anon, "/api/auth", { action: "register", ...identities[0] })).status === 409);

  const secondSession = client();
  let result = await call(secondSession, "/api/auth", { action: "login", username: identities[0].email.toUpperCase(), password });
  ok("logowanie e-mailem bez rozróżniania wielkości liter", result.status === 200);
  secondSession.token = result.data.token;
  const revoked = secondSession.token;
  await call(secondSession, "/api/auth", { action: "logout" });
  secondSession.token = revoked;
  ok("unieważniony token nie działa po wylogowaniu", (await secondSession.call("/api/auth")).data.user === null);
  ok("nie może tworzyć grup po wylogowaniu", (await call(secondSession, "/api/groups", { name: "Nie wolno" })).status === 401);
  ok("wylogowanie nie niszczy innej sesji tego samego użytkownika", (await A.call("/api/auth")).data.user.username === identities[0].username);

  const uploaded = [];
  for (const file of audioFixtures()) {
    const form = new FormData(); form.append("audio", new File([file.buffer], file.name, { type: file.mimeType })); form.append("title", `Test ${file.name}`); form.append("duration", "12");
    const r = await A.call("/api/tracks", { method: "POST", form });
    ok(`wgranie prawidłowego ${file.name}`, r.status === 200 && !!r.data.track?.id);
    const track = r.data.track; uploaded.push(track);
    const stream = await anon.call(`/api/stream/${track.id}`, { raw: true });
    ok(`identyczne bajty ${file.name}`, stream.status === 200 && stream.headers.get("content-type") === file.mimeType && stream.data.equals(file.buffer));
    const partial = await anon.call(`/api/stream/${track.id}`, { raw: true, headers: { Range: "bytes=10-109" } });
    ok(`przewijanie HTTP Range ${file.name}`, partial.status === 206 && partial.data.equals(file.buffer.subarray(10,110)));
  }
  const invalid = new FormData(); invalid.append("audio", new File(["plain text"], "notes.txt", { type: "text/plain" }));
  ok("plik nieaudio odrzucony", (await A.call("/api/tracks", { method: "POST", form: invalid })).status === 400);
  const trackId = uploaded[0].id;
  ok("gość nie może dodać muzyki", (await anon.call("/api/tracks", { method: "POST", form: invalid })).status === 401);
  ok("obcy nie może usunąć nagrania", (await B.call(`/api/tracks/${trackId}`, { method: "DELETE" })).status === 403);

  result = await call(A, "/api/playlists", { name: "Testowa", description: "Test", isPrivate: true });
  ok("tworzenie prywatnej playlisty", result.status === 200); const pid = result.data.playlist.id;
  ok("publiczny odczyt prywatnej playlisty zabroniony", (await B.call(`/api/playlists/${pid}`)).status === 403);
  result = await call(A, `/api/playlists/${pid}/tracks`, { trackId });
  ok("dodanie utworu", result.data.playlist.tracks.length === 1);
  result = await call(A, `/api/playlists/${pid}/tracks`, { trackIds: [] }, "PUT");
  ok("usunięcie ostatniego utworu", result.data.playlist.tracks.length === 0);
  await call(A, `/api/playlists/${pid}/tracks`, { trackId });
  await call(A, `/api/playlists/${pid}`, { isPrivate: false }, "PATCH");
  ok("publiczna playlista dostępna", (await B.call(`/api/playlists/${pid}`)).status === 200);
  ok("polubienie utworu", (await call(A, "/api/likes", { kind: "track", id: trackId })).data.liked === true);
  ok("polubienie playlisty", (await call(B, "/api/likes", { kind: "playlist", id: pid })).data.liked === true);

  result = await call(A, "/api/groups", { name: "Grupa testowa" });
  ok("tworzenie grupy", result.status === 200 && result.data.group.isMember); const gid = result.data.group.id;
  ok("spoza grupy nie można publikować", (await call(B, `/api/groups/${gid}/posts`, { body: "Nie wolno" })).status === 403);
  ok("dołączenie do grupy", (await call(B, `/api/groups/${gid}`, { action: "join" })).data.group.memberCount === 2);
  ok("post w grupie", (await call(B, `/api/groups/${gid}/posts`, { body: "Test" })).data.group.posts.length === 1);
  ok("wspólna playlista w grupie", (await call(A, `/api/groups/${gid}/playlists`, { playlistId: pid })).data.group.playlists.length === 1);
  ok("opuszczenie grupy", (await call(B, `/api/groups/${gid}`, { action: "leave" })).data.group.isMember === false);

  result = await call(A, "/api/comments", { trackId, body: "Komentarz" }); const cid = result.data.comments[0].id;
  result = await call(B, "/api/comments", { trackId, parentId: cid, body: "Odpowiedź" });
  ok("komentarz i odpowiedź", result.data.comments[0].replies.length === 1);
  ok("tekst ze znacznikami czasu", (await call(A, "/api/lyrics", { trackId, lines: "0:01 - pierwsza\n0:03 - druga" })).data.lyrics.synced === true);
  await call(A, "/api/stats/listen", { trackId, seconds: 6 });
  ok("statystyki odsłuchu", (await A.call("/api/stats")).data.stats.totalSeconds === 6);
  await call(A, "/api/settings", { accent: "widmo" }, "PUT");
  ok("ustawienia zapisane w bazie", (await A.call("/api/settings")).data.settings.accent === "widmo");
  const userA = (await A.call("/api/auth")).data.user;
  ok("obserwowanie profilu", (await call(B, "/api/follows", { userId: userA.id })).data.following === true);
  const profile = (await B.call(`/api/users/${identities[0].username}`)).data;
  ok("profil nie udostępnia e-maila", !('email' in profile.profile.user));
  ok("usunięcie konta bez hasła odrzucone", (await call(A, "/api/auth", { action: "delete" })).status === 400);
  ok("usunięcie konta z hasłem", (await call(A, "/api/auth", { action: "delete", password })).status === 200);
  ok("token usuniętego konta unieważniony", (await A.call("/api/auth")).data.user === null);
  ok("token usuniętego konta nie pozwala pisać", (await call(A, "/api/groups", { name: "Nie wolno" })).status === 401);
  ok("plik usuniętego konta niedostępny", (await anon.call(`/api/stream/${trackId}`, { raw: true })).status === 404);
  console.log(`Zaliczone kontrole API: ${checks}`);
} catch (error) { console.error(error); process.exitCode = 1; }
finally {
  for (const identity of identities) {
    const c = client();
    const r = await call(c, "/api/auth", { action: "login", username: identity.username, password });
    if (r.data.token) { c.token = r.data.token; await call(c, "/api/auth", { action: "delete", password }); }
  }
  console.log("Usunięto wyłącznie konta testowe. Obrazek marki i inne konta nietknięte.");
}
