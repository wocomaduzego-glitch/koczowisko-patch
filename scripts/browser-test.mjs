import { chromium, expect } from "@playwright/test";
import { audioFixtures } from "./test-audio.mjs";

const BASE = process.env.BASE || "http://127.0.0.1:3000";
const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const users = ["a", "b"].map((letter) => ({ username: `web_${letter}_${suffix}`, email: `web_${letter}_${suffix}@example.invalid`, password: "NotebookTest!42", displayName: `Test Web ${letter.toUpperCase()}` }));
const errors = [];
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
let passed = 0;
const pass = (name) => { passed++; console.log(`PASS ${name}`); };
const contexts = [];
let pageA;

async function makePage(options = {}) {
  const context = await browser.newContext({ viewport: { width: 1365, height: 950 }, ...options });
  contexts.push(context);
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto(`${BASE}/web`);
  await expect(page.getByRole("heading", { name: "Do pierwszego odsłuchu" })).toBeVisible();
  return page;
}
async function register(page, user) {
  await page.getByRole("button", { name: "Dołącz do Koczowiska", exact: true }).click();
  await page.getByRole("tab", { name: "Załóż konto", exact: true }).click();
  const form = page.getByRole("form", { name: "Rejestracja" });
  await form.getByLabel("Nazwa użytkownika", { exact: true }).fill(user.username);
  await form.getByLabel("Nazwa wyświetlana", { exact: true }).fill(user.displayName);
  await form.getByLabel("E-mail", { exact: true }).fill(user.email);
  await form.getByLabel("Hasło").fill(user.password);
  await form.getByRole("button", { name: "Utwórz konto", exact: true }).click();
  await expect(page.getByTitle("Mój profil", { exact: true })).toBeVisible();
}
async function login(page, identifier, password) {
  await page.getByRole("button", { name: "Dołącz do Koczowiska", exact: true }).click();
  const form = page.getByRole("form", { name: "Logowanie" });
  await form.getByLabel("Nazwa użytkownika lub e-mail", { exact: true }).fill(identifier);
  await form.getByLabel("Hasło", { exact: true }).fill(password);
  await form.getByLabel("Hasło", { exact: true }).press("Enter");
}
async function nav(page, label) {
  await page.locator("aside nav").getByRole("button", { name: label, exact: true }).click();
}
async function api(page, url, body) {
  return page.evaluate(async ({ url, body }) => {
    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("koc_token")}` };
    const r = await fetch(url, { method: body ? "POST" : "GET", headers, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.json() };
  }, { url, body });
}

try {
  pageA = await makePage();
  pass("/web wyświetla działający interfejs bez Electron/EXE");
  if (await pageA.getByRole("button", { name: "Dodaj do pulpitu", exact: true }).count()) {
    await pageA.getByRole("button", { name: "Dodaj do pulpitu", exact: true }).click();
    await expect(pageA.getByRole("status").filter({ hasText: "Instalacja jest opcjonalna" })).toBeVisible();
    await pageA.getByRole("button", { name: "Dodaj do pulpitu", exact: true }).click();
  } else { await expect(pageA.getByRole("button", { name: "Zainstaluj aplikację" })).toBeVisible(); }
  pass("dostępna instalacja lub instrukcja instalacji w przeglądarce");
  await register(pageA, users[0]); pass("rejestracja z formularza w Chromium");
  await pageA.reload();
  await expect(pageA.getByTitle("Mój profil", { exact: true })).toBeVisible();
  pass("sesja po odświeżeniu strony");

  const state = await pageA.context().storageState();
  const restored = await makePage({ storageState: state });
  await expect(restored.getByTitle("Mój profil", { exact: true })).toBeVisible();
  pass("sesja odtworzona w nowym kontekście przeglądarki");
  await restored.close();
  const cookieOnly = await makePage({ storageState: { cookies: state.cookies, origins: [] } });
  await expect(cookieOnly.getByTitle("Mój profil", { exact: true })).toBeVisible();
  pass("logowanie przez samo ciasteczko httpOnly"); await cookieOnly.close();
  await pageA.context().clearCookies(); await pageA.reload();
  await expect(pageA.getByTitle("Mój profil", { exact: true })).toBeVisible();
  pass("logowanie przy zablokowanych ciasteczkach — token przeglądarki");

  const oldToken = await pageA.evaluate(() => localStorage.getItem("koc_token"));
  await pageA.getByRole("button", { name: "Wyloguj się", exact: true }).click();
  await expect(pageA.getByRole("button", { name: "Dołącz do Koczowiska", exact: true })).toBeVisible();
  const replay = await fetch(`${BASE}/api/auth`, { headers: { Authorization: `Bearer ${oldToken}` } }).then((r) => r.json());
  expect(replay.user).toBeNull(); pass("wylogowanie odrzuca stary token na serwerze");
  await login(pageA, users[0].username, "zlehaslo");
  await expect(pageA.getByRole("form", { name: "Logowanie" }).getByRole("alert")).toHaveText("Nieprawidłowy login lub hasło");
  pass("błędne hasło: komunikat w formularzu");
  const loginForm = pageA.getByRole("form", { name: "Logowanie" });
  await loginForm.getByLabel("Nazwa użytkownika lub e-mail", { exact: true }).fill(users[0].email);
  await loginForm.getByLabel("Hasło", { exact: true }).fill(users[0].password);
  await loginForm.getByLabel("Hasło", { exact: true }).press("Enter");
  await expect(pageA.getByTitle("Mój profil", { exact: true })).toBeVisible();
  pass("logowanie adresem e-mail i Enter");

  await nav(pageA, "Grupy");
  await pageA.getByRole("button", { name: "Nowa grupa", exact: true }).click();
  const groupDialog = pageA.getByRole("dialog", { name: "Nowa grupa muzyczna" });
  const groupName = `Próba przeglądarki ${suffix}`;
  await groupDialog.getByLabel("Nazwa grupy").fill(groupName);
  await groupDialog.getByLabel("Opis", { exact: true }).fill("Tymczasowa grupa do sprawdzenia UI");
  await groupDialog.getByRole("button", { name: "Utwórz grupę" }).click();
  await expect(pageA.getByRole("heading", { name: new RegExp(groupName) })).toBeVisible();
  await expect(pageA.getByPlaceholder("Napisz coś krótko – max 500 znaków…")).toBeVisible();
  pass("tworzenie grupy po logowaniu i wejście w jej widok");
  await pageA.getByPlaceholder("Napisz coś krótko – max 500 znaków…").fill("Post testowy właściciela");
  await pageA.getByRole("button", { name: "Opublikuj", exact: true }).click();
  await expect(pageA.getByText("Post testowy właściciela", { exact: true })).toBeVisible();
  pass("publikacja posta w grupie");

  const pageB = await makePage();
  await register(pageB, users[1]); await nav(pageB, "Grupy");
  await pageB.getByText(groupName, { exact: true }).click();
  await pageB.getByRole("button", { name: "Dołącz do kręgu", exact: true }).click();
  await expect(pageB.getByPlaceholder("Napisz coś krótko – max 500 znaków…")).toBeVisible();
  await pageB.getByPlaceholder("Napisz coś krótko – max 500 znaków…").fill("Post drugiego użytkownika");
  await pageB.getByRole("button", { name: "Opublikuj", exact: true }).click();
  await expect(pageB.getByText("Post drugiego użytkownika", { exact: true })).toBeVisible();
  pass("drugie konto: dołączanie, odświeżenie uprawnień, publikacja posta");

  await nav(pageA, "Twoja Biblioteka");
  const realAudio = audioFixtures();
  await pageA.locator('input[type="file"][accept*=".mp3"]').setInputFiles(realAudio[0]);
  const uploadDialog = pageA.getByRole("dialog", { name: "Dodaj pliki (1)", exact: true });
  await expect(uploadDialog).toBeVisible();
  const songName = `WAV ${suffix}`;
  await uploadDialog.getByLabel("Tytuł", { exact: true }).fill(songName);
  await uploadDialog.getByRole("button", { name: "Dodaj do biblioteki" }).click();
  await expect(uploadDialog).not.toBeVisible();
  await pageA.getByRole("button", { name: "Dodane przeze mnie", exact: true }).click();
  await expect(pageA.getByText(songName, { exact: true })).toBeVisible();
  await Promise.all([
    pageA.waitForResponse((r) => r.url().includes("/api/stream/") && [200,206].includes(r.status())),
    pageA.getByRole("button", { name: "Odtwórz", exact: true }).click(),
  ]);
  await expect(pageA.getByRole("slider", { name: "Pozycja odtwarzania" })).toBeVisible();
  await expect.poll(() => pageA.getByRole("slider", { name: "Pozycja odtwarzania" }).inputValue()).not.toBe("0");
  await pageA.getByRole("button", { name: "Pauza", exact: true }).last().click();
  pass("wgranie prawdziwego WAV z formularza i dekodowanie/odtwarzanie w Chromium");
  for (const file of realAudio.slice(1)) {
    await pageA.locator('input[type="file"][accept*=".mp3"]').setInputFiles(file);
    const modal = pageA.getByRole("dialog", { name: "Dodaj pliki (1)", exact: true });
    const title = `${file.name} ${suffix}`;
    await modal.getByLabel("Tytuł", { exact: true }).fill(title);
    await modal.getByRole("button", { name: "Dodaj do biblioteki" }).click();
    await expect(modal).not.toBeVisible();
    const row = pageA.locator("main .group.grid").filter({ hasText: title });
    await row.getByRole("button", { name: "Odtwórz", exact: true }).click();
    await expect(pageA).toHaveTitle(new RegExp(title.replace(".", "\\.")));
    await expect.poll(() => pageA.getByRole("slider", { name: "Pozycja odtwarzania" }).inputValue()).not.toBe("0");
    await expect(pageA.getByRole("button", { name: "Pauza", exact: true }).last()).toBeVisible();
    await pageA.getByRole("button", { name: "Pauza", exact: true }).last().click();
    pass(`dekodowanie i odtwarzanie prawdziwego ${file.name} w Chromium`);
  }


  await pageA.locator("aside").getByRole("button", { name: "Nowa playlista", exact: true }).click();
  const plDialog = pageA.getByRole("dialog", { name: "Nowa playlista", exact: true });
  const playlistName = `Selekcja ${suffix}`;
  await plDialog.getByLabel("Nazwa", { exact: true }).fill(playlistName);
  await plDialog.getByRole("button", { name: "Utwórz playlistę" }).click();
  await expect(pageA.getByRole("heading", { name: playlistName, exact: true })).toBeVisible();
  await pageA.getByRole("button", { name: "Dodaj utwory", exact: true }).first().click();
  const add = pageA.getByRole("dialog", { name: `Dodaj utwory: ${playlistName}` });
  await add.locator("div.flex.items-center.gap-3").filter({ hasText: songName }).getByRole("button", { name: "Dodaj", exact: true }).click();
  await expect(add.getByText("w playlistach", { exact: true })).toBeVisible();
  await add.getByRole("button", { name: "Zamknij", exact: true }).click();
  await expect(pageA.getByText(songName, { exact: true }).first()).toBeVisible();
  pass("tworzenie playlisty i dodanie własnej muzyki");

  await nav(pageA, "Grupy"); await pageA.getByRole("button", { name: "Wejdź do kręgu", exact: true }).click();
  const optionValue = await pageA.locator("main select option").filter({ hasText: playlistName }).getAttribute("value");
  await pageA.locator("main select").selectOption(optionValue);
  await pageA.getByRole("button", { name: "Udostępnij", exact: true }).click();
  await expect(pageA.locator("main").getByRole("button", { name: playlistName, exact: true })).toBeVisible();
  pass("udostępnienie playlisty w grupie przez interfejs");

  await nav(pageA, "Ustawienia");
  const badgeCard = pageA.locator('[data-testid="badge-admin"]');
  await badgeCard.getByLabel("Hasło do odznak").fill("zle-haslo");
  await badgeCard.getByRole("button", { name: "Odblokuj odznaki" }).click();
  await expect(badgeCard.getByRole("alert")).toContainText("Nieprawidłowe hasło");
  await badgeCard.getByLabel("Hasło do odznak").fill("123_Kocz!");
  await badgeCard.getByRole("button", { name: "Odblokuj odznaki" }).click();
  await expect(pageA.getByText("Panel odblokowany")).toBeVisible();
  await badgeCard.locator('[data-badge="og"]').getByRole("button", { name: "Dodaj", exact: true }).click();
  await expect(pageA.getByText("Nadano odznakę OG")).toBeVisible();
  await expect(badgeCard.getByRole("button", { name: "Usuń", exact: true }).first()).toBeVisible();
  pass("odznaki: hasło, błąd hasła, odblokowanie i nadanie OG w Ustawieniach");
  await pageA.getByTitle("Mój profil", { exact: true }).click();
  await expect(pageA.getByText("OG", { exact: true }).first()).toBeVisible();
  pass("kropka i nazwa odznaki widoczne na profilu");

  await nav(pageA, "Ustawienia");
  await pageA.getByLabel("Nazwa wyświetlana", { exact: true }).press("End");
  await pageA.getByLabel("Nazwa wyświetlana", { exact: true }).pressSequentially(" X", { delay: 10 });
  expect(await pageA.getByLabel("Nazwa wyświetlana", { exact: true }).inputValue()).toBe(users[0].displayName + " X");
  pass("edycja pola profilu bez utraty fokusu");

  // Mobile viewport: same web app, no Electron required.
  await pageA.setViewportSize({ width: 390, height: 844 });
  expect(await pageA.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(pageA.getByRole("button", { name: "Menu", exact: true })).toBeVisible();
  await expect(pageA.getByRole("slider", { name: "Pozycja odtwarzania" })).toBeVisible();
  pass("wersja mobilna bez poziomego przepełnienia");
  await pageA.screenshot({ path: "/tmp/kocz-web-mobile.png" });
  await pageA.setViewportSize({ width: 1365, height: 950 });

  const manifest = await fetch(`${BASE}/manifest.webmanifest`).then((r) => r.json());
  expect(manifest.start_url).toBe("/web");
  await pageA.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  pass("manifest PWA i aktywny service worker");
  await pageA.context().setOffline(true); await pageA.goto(`${BASE}/web`);
  await expect(pageA.getByRole("heading", { name: "Brak połączenia", exact: true })).toBeVisible();
  await pageA.context().setOffline(false); await pageA.getByRole("link", { name: "Spróbuj ponownie" }).click();
  await expect(pageA.getByTitle("Mój profil", { exact: true })).toBeVisible();
  pass("uczciwy ekran offline i powrót do zachowanej sesji");

  await pageA.getByRole("button", { name: "Wyloguj się", exact: true }).click();
  await expect(pageA.getByRole("button", { name: "Dołącz do Koczowiska", exact: true })).toBeVisible();
  await login(pageA, users[0].username, users[0].password);
  await expect(pageA.getByTitle("Mój profil", { exact: true })).toBeVisible();
  pass("ponowne logowanie nazwą użytkownika przez formularz");
  const deletionToken = await pageA.evaluate(() => localStorage.getItem("koc_token"));
  await nav(pageA, "Ustawienia");
  await pageA.getByRole("button", { name: "Usuń konto", exact: true }).click();
  const deletion = pageA.getByRole("dialog", { name: "Usuń konto", exact: true });
  await deletion.getByLabel("Potwierdź hasłem").fill(users[0].password);
  await deletion.getByRole("button", { name: "Definitywnie usuń konto", exact: true }).click();
  await expect(pageA.getByRole("button", { name: "Dołącz do Koczowiska", exact: true })).toBeVisible();
  const deletedSession = await fetch(`${BASE}/api/auth`, { headers: { Authorization: `Bearer ${deletionToken}` } }).then((r) => r.json());
  expect(deletedSession.user).toBeNull();
  pass("usunięcie konta z formularza unieważnia sesję i nie przywraca profilu z cache");

  expect(errors).toEqual([]); pass("brak błędów JavaScript podczas całego scenariusza");
  await pageA.screenshot({ path: "/tmp/kocz-web-desktop.png" });
} catch (error) {
  if (pageA) { await pageA.screenshot({ path: "/tmp/kocz-browser-failure.png" }).catch(() => {}); console.log((await pageA.locator("body").innerText().catch(() => "")).slice(-4500)); }
  console.error(error); process.exitCode = 1;
} finally {
  // Only generated test accounts are removed; no user data or brand asset is touched.
  for (const user of users) {
    const auth = await fetch(`${BASE}/api/auth`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "login", username: user.username, password: user.password }) }).then((r) => r.json());
    if (auth.token) await fetch(`${BASE}/api/auth`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.token}` }, body: JSON.stringify({ action: "delete", password: user.password }) });
  }
  await browser.close();
  console.log(`Zaliczone scenariusze przeglądarkowe: ${passed}. Konta testowe usunięte.`);
}
