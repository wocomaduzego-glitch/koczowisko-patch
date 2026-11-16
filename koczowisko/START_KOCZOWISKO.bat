@echo off
setlocal
cd /d "%~dp0"
title Koczowisko - okno aplikacji

echo ==================================================
echo   KOCZOWISKO - okno aplikacji
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

if exist ".next\BUILD_ID" goto run
echo Budowanie aplikacji...
call npm run build
if errorlevel 1 goto failed

:run
echo Uruchamianie serwera...
start "Koczowisko - serwer" /min cmd /c "npm run start"
echo Czekam na serwer...
node -e "const check=async()=>{for(let i=0;i<40;i++){try{const r=await fetch('http://127.0.0.1:3000/api/health');if(r.ok)return true}catch{}await new Promise(r=>setTimeout(r,500))}return false};check().then(ok=>process.exit(ok?0:1))"
if errorlevel 1 goto server_failed

echo Otwieram aplikacje...
start "" msedge --app=http://127.0.0.1:3000/web
echo.
echo Serwer dziala w osobnym, zminimalizowanym oknie.
echo Zamkniecie tego okna nie zatrzymuje serwera - zamknij okno "Koczowisko - serwer".
pause
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

:server_failed
echo [BLAD] Serwer nie odpowiedzial w ciagu 20 sekund.
echo Sprawdz okno "Koczowisko - serwer" oraz polaczenie z PostgreSQL.
pause
exit /b 1

:failed
echo [BLAD] Operacja nie powiodla sie. Przeczytaj komunikat powyzej.
pause
exit /b 1
