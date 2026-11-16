# Koczowisko - budowanie paczki EXE (PowerShell 5+ / Windows 10-11)
# Uruchom: prawy przycisk -> "Uruchom w programie PowerShell"
$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

Write-Host "=== KOCZOWISKO: budowanie paczki Koczowisko.exe ===" -ForegroundColor Cyan

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[BLAD] Nie znaleziono Node.js w PATH." -ForegroundColor Red
    Write-Host "Zainstaluj Node.js LTS 22 z https://nodejs.org, potem otworz NOWE okno PowerShell."
    Read-Host "Nacisnij Enter, aby zamknac"
    exit 1
}

$major = [int]((node -p "process.versions.node.split('.')[0]").Trim())
if ($major -lt 20) {
    Write-Host "[BLAD] Wymagany Node.js 20 lub nowszy. Masz: $(node -v)" -ForegroundColor Red
    Read-Host "Nacisnij Enter, aby zamknac"
    exit 1
}

node scripts/build-exe.mjs
if ($LASTEXITCODE -ne 0) {
    Write-Host "[BLAD] Budowanie nie powiodlo sie. Komunikat powyzej." -ForegroundColor Red
    Read-Host "Nacisnij Enter, aby zamknac"
    exit 1
}

$out = Join-Path $PSScriptRoot "dist-desktop\release\Koczowisko-win32-x64"
if (Test-Path $out) { Start-Process explorer.exe $out }

Write-Host ""
Write-Host "Gotowe. Wpisz adres serwera w koczowisko-url.txt w folderze z EXE." -ForegroundColor Green
Read-Host "Nacisnij Enter, aby zamknac"
