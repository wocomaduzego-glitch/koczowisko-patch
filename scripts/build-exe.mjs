#!/usr/bin/env node
/**
 * Buduje paczkę Koczowisko.exe (Windows x64) bez zależności od interpretacji pliku .bat.
 * Użycie:
 *   node scripts/build-exe.mjs            # pełna kompilacja
 *   node scripts/build-exe.mjs --dry-run  # tylko sprawdzenie środowiska i plików
 *   KOCZ_SERVER_URL=https://adres.pl node scripts/build-exe.mjs
 *
 * Paczka EXE to WYŁĄCZNIE okno aplikacji. Do działania potrzebuje serwera Koczowiska
 * (adres wpisany w koczowisko-url.txt). Nie zawiera bazy ani backendu.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const dryRun = process.argv.includes("--dry-run");
const root = process.cwd();
const outDir = path.join(root, "dist-desktop");
const releaseDir = path.join(outDir, "release", "Koczowisko-win32-x64");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

const guide = () => `
JAK PODLACZYC SERWER — KOCZOWISKO

Ten folder to tylko okno aplikacji. Nie zawiera serwera Koczowiska,
bazy PostgreSQL ani plikow muzycznych.

1. Uruchom serwer Koczowiska na swoim komputerze lub hostingu.
2. Otworz plik koczowisko-url.txt w tym folderze (Notatnik).
3. Wpisz w nim adres serwera, np. https://twoj-adres.pl — bez spacji.
4. Zapisz plik i uruchom Koczowisko.exe.
5. Sprawdz, czy https://twoj-adres.pl/api/health zwraca {"ok":true}.

Mozesz wyslac ten folder znajomym TYLKO razem z dzialajacym serwerem.
Bez adresu serwera program pokaze komunikat o braku polaczenia.
`.trimStart();

function fail(message) {
  console.error(`\n[BŁĄD] ${message}\n`);
  process.exit(1);
}

function run(command, args, cwd) {
  console.log(`> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
  if (result.error) fail(`Nie można uruchomić "${command}": ${result.error.message}. Sprawdź, czy Node.js jest zainstalowany i dostępny w PATH (nowe okno terminala).`);
  if (result.status !== 0) fail(`Polecenie "${command} ${args.join(" ")}" zakończyło się kodem ${result.status}.`);
}

console.log("=== KOCZOWISKO: budowanie paczki Koczowisko.exe ===");
if (Number(process.versions.node.split(".")[0]) < 20) fail(`Wymagany Node.js 20 lub nowszy. Wykryto ${process.versions.node}.`);
if (!existsSync(path.join(root, "desktop", "main.cjs"))) fail("Brak pliku desktop/main.cjs. Uruchom skrypt w głównym folderze projektu.");

mkdirSync(outDir, { recursive: true });
copyFileSync(path.join(root, "desktop", "main.cjs"), path.join(outDir, "main.js"));
writeFileSync(path.join(outDir, "package.json"), JSON.stringify({
  name: "koczowisko-desktop",
  version: "3.0.0",
  description: "Koczowisko — okno aplikacji muzycznej",
  main: "main.js",
  private: true,
}, null, 2) + "\n", "utf8");
console.log("✓ Przygotowano pliki okna aplikacji (dist-desktop).");

if (dryRun) {
  console.log("\n=== TRYB SPRAWDZANIA (--dry-run) ===");
  console.log("Node.js:", process.versions.node, "| npm:", npm, "| platforma:", process.platform);
  console.log("Pliki gotowe. Uruchom bez --dry-run, aby pobrać Electron i zbudować EXE.");
  process.exit(0);
}

run(npm, ["install", "--no-audit", "--no-fund", "--save-dev", "electron", "@electron/packager"], outDir);
console.log("✓ Pobrano Electron i narzędzie pakujące.");

run(npx, ["--no-install", "@electron/packager", ".", "Koczowisko", "--platform=win32", "--arch=x64", "--overwrite", "--out=release"], outDir);

const exePath = path.join(releaseDir, "Koczowisko.exe");
if (!existsSync(exePath)) fail(`Nie znaleziono gotowego pliku. Oczekiwano: ${exePath}`);

const urlFile = path.join(releaseDir, "koczowisko-url.txt");
const providedUrl = (process.env.KOCZ_SERVER_URL || "").trim();
if (providedUrl) writeFileSync(urlFile, `${providedUrl.replace(/\/+$/, "")}\n`, "ascii");
else if (!existsSync(urlFile)) writeFileSync(urlFile, "", "ascii");
writeFileSync(path.join(releaseDir, "JAK_PODLACZYC_SERWER.txt"), guide(), "utf8");

const storedUrl = existsSync(urlFile) ? readFileSync(urlFile, "utf8").trim() : "";
console.log("\n=== GOTOWE ===");
console.log(exePath);
console.log(storedUrl
  ? `Adres serwera w paczce: ${storedUrl}`
  : "UWAGA: koczowisko-url.txt jest pusty. Wpisz adres działającego serwera, inaczej EXE pokaże brak połączenia.");
console.log("Cały folder Koczowisko-win32-x64 spakuj do ZIP i wyślij razem z adresem serwera.");
