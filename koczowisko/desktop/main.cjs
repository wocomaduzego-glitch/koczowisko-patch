/**
 * Koczowisko — okno aplikacji desktopowej (Electron, Windows 10 / 11).
 *
 * Dwa tryby pracy:
 * 1) Lokalny (domyślny): jeśli pod http://127.0.0.1:3000 nie działa jeszcze serwer,
 *    skrypt sam uruchamia zbudowany serwer Next.js w tle i zamyka go przy wyjściu.
 * 2) Online (wspólne konta i grupy ze znajomymi przez internet): ustaw zmienną
 *    KOCZ_SERVER_URL=https://twoj-adres-aplikacji.pl (w pliku koczowisko-url.txt obok .exe
 *    lub w zmiennej środowiskowej), a aplikacja .exe połączy się od razu ze wspólnym serwerem.
 */
const { app, BrowserWindow, shell, dialog } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");
const path = require("node:path");

let mainWindow = null;
let serverProc = null;

function resolveServerUrl() {
  if (process.env.KOCZ_SERVER_URL) return process.env.KOCZ_SERVER_URL.trim().replace(/\/+$/, "");
  const candidates = [
    path.join(path.dirname(process.execPath), "koczowisko-url.txt"),
    path.join(process.cwd(), "koczowisko-url.txt"),
  ];
  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) {
        const raw = fs.readFileSync(file, "utf8").trim();
        if (/^https?:\/\//i.test(raw)) return raw.replace(/\/+$/, "");
      }
    } catch {
      /* ignoruj */
    }
  }
  return "http://127.0.0.1:3000";
}

function checkHealth(baseUrl) {
  return new Promise((resolve) => {
    const target = `${baseUrl}/api/health`;
    const lib = target.startsWith("https") ? https : http;
    const req = lib.get(target, { timeout: 2500 }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function ensureServer(baseUrl) {
  if (await checkHealth(baseUrl)) return { ok: true };

  const isLocal = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(baseUrl);
  if (!isLocal) return { ok: false, reason: "remote" };

  const appRoot = fs.existsSync(path.join(process.cwd(), "next.config.ts"))
    ? process.cwd()
    : path.resolve(__dirname, "..");
  const nextBin = path.join(appRoot, "node_modules", "next", "dist", "bin", "next");

  // Pakiet .exe zawiera tylko okno aplikacji, a nie serwer, bazę ani pliki projektu.
  if (!fs.existsSync(nextBin)) return { ok: false, reason: "no-local-server" };

  const portMatch = /:(\d+)$/.exec(baseUrl);
  const port = portMatch ? portMatch[1] : "3000";

  serverProc = spawn("node", [nextBin, "start", "-p", port], {
    cwd: appRoot,
    env: { ...process.env, NODE_ENV: "production" },
    stdio: "ignore",
    windowsHide: true,
  });

  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await checkHealth(baseUrl)) return { ok: true };
  }
  return { ok: false, reason: "local-failed" };
}

async function createWindow() {
  const baseUrl = resolveServerUrl();

  mainWindow = new BrowserWindow({
    width: 1320,
    height: 840,
    minWidth: 940,
    minHeight: 620,
    backgroundColor: "#f5f5f2",
    title: "Koczowisko",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  let result = await ensureServer(baseUrl);
  while (!result.ok) {
    const hint =
      result.reason === "remote"
        ? `Serwer ${baseUrl} jest chwilowo niedostępny. Sprawdź internet i spróbuj ponownie.`
        : result.reason === "no-local-server"
          ? "Ten plik .exe to tylko okno aplikacji. Nie zawiera serwera Koczowiska, bazy PostgreSQL ani plików muzyki. Wpisz adres działającego serwera online w pliku koczowisko-url.txt obok pliku Koczowisko.exe (np. https://twoj-adres.pl). Sam plik .exe wysłany znajomemu bez serwera nie zadziała."
          : "Lokalny serwer nie odpowiedział. Sprawdź połączenie z PostgreSQL i uruchom projekt poleceniem START_KOCZOWISKO.bat albo START_W_PRZEGLADARCE.bat.";
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: "error",
      title: "Koczowisko — brak połączenia z serwerem",
      message: "Nie można otworzyć aplikacji bez działającego serwera Koczowiska.",
      detail: `${hint}\n\nAdres, z którym próbowano się połączyć: ${baseUrl}`,
      buttons: ["Spróbuj ponownie", "Otwórz w przeglądarce", "Zamknij"],
      defaultId: 0,
      cancelId: 2,
    });
    if (response === 2) { app.quit(); return; }
    if (response === 1) { shell.openExternal(baseUrl); app.quit(); return; }
    result = await ensureServer(baseUrl);
  }

  await mainWindow.loadURL(baseUrl);
}

function stopLocalServer() {
  if (serverProc && !serverProc.killed) {
    try {
      serverProc.kill();
    } catch {
      /* ignoruj */
    }
    serverProc = null;
  }
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  stopLocalServer();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", stopLocalServer);
