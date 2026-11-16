@echo off
setlocal
cd /d "%~dp0"
title Koczowisko - wersja przegladarkowa

echo ==================================================
echo   KOCZOWISKO - uruchamianie w przegladarce
echo ==================================================
echo.

where node >nul 2>nul
if errorlevel 1 goto no_node

if not exist ".env" goto no_env

if exist "node_modules\next" goto schema
echo Instalowanie bibliotek...
call npm install
if errorlevel 1 goto failed

:schema
echo Aktualizacja schematu bazy...
call npx drizzle-kit push
if errorlevel 1 goto db_failed

echo Budowanie aplikacji...
call npm run build
if errorlevel 1 goto failed

echo Uruchamianie serwera i otwieranie przegladarki...
node scripts\start-browser.mjs
exit /b 0

:no_node
echo [BLAD] Nie znaleziono Node.js w PATH. Zainstaluj Node.js LTS 22 z https://nodejs.org
pause
exit /b 1

:no_env
echo [BLAD] Brak pliku .env
echo Skopiuj .env.example do .env i wpisz adres bazy PostgreSQL.
pause
exit /b 1

:db_failed
echo [BLAD] Nie mozna polaczyc sie z baza PostgreSQL. Sprawdz DATABASE_URL w pliku .env.
pause
exit /b 1

:failed
echo [BLAD] Operacja nie powiodla sie. Przeczytaj komunikat powyzej.
pause
exit /b 1
