@echo off
setlocal
cd /d "%~dp0"
title Koczowisko - budowanie EXE

echo ==================================================
echo   KOCZOWISKO 3.0 - budowanie paczki Koczowisko.exe
echo ==================================================
echo.

where node >nul 2>nul
if errorlevel 1 goto no_node

node -e "process.exit(Number(process.versions.node.split('.')[0])<20?1:0)"
if errorlevel 1 goto old_node

node scripts\build-exe.mjs
if errorlevel 1 goto failed

echo.
echo Gotowe. Otwieram folder z plikiem EXE...
start "" "dist-desktop\release\Koczowisko-win32-x64"
pause
exit /b 0

:no_node
echo [BLAD] Nie znaleziono Node.js w PATH.
echo Zainstaluj Node.js LTS 22 lub nowszy z https://nodejs.org
echo Po instalacji zamknij to okno i uruchom skrypt ponownie.
pause
exit /b 1

:old_node
echo [BLAD] Masz zbyt stara wersje Node.js.
echo Zainstaluj Node.js 22 LTS z https://nodejs.org
pause
exit /b 1

:failed
echo.
echo [BLAD] Budowanie nie powiodlo sie. Przeczytaj komunikat powyzej.
echo Mozesz uruchomic recznie: node scripts\build-exe.mjs
pause
exit /b 1
