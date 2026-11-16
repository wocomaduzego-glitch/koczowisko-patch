# Koczowisko Web

Muzyczna aplikacja Next.js App Router + PostgreSQL / Drizzle, z jasnym motywem zeszytu. Wersja przeglądarkowa jest pod **`/web`**, działa też pod `/`. Nie wymaga EXE ani Electron.

**Instrukcja:** [INSTRUKCJA_PRZEGLADARKA.md](INSTRUKCJA_PRZEGLADARKA.md).
**Start Windows w przeglądarce:** `START_W_PRZEGLADARCE.bat` (wymaga Node.js 22+ i działającej bazy PostgreSQL; połączenie w `.env`).

## Uruchomienie

```bash
npm install
npx drizzle-kit push
npm run build
node scripts/start-browser.mjs
```

Aplikacja działa na `http://127.0.0.1:3000/web`. Do rozwoju: `npm run dev`.
Konfiguracja Drizzle czyta `DATABASE_URL` z `.env` — nie ma osobnego, wpisanego na sztywno adresu bazy.

## Funkcje

- Rejestracja i logowanie nazwą użytkownika lub e-mailem, profil, wylogowanie, usuwanie konta.
- Trwałe, losowe sesje hashowane w bazie PostgreSQL; 180 dni od ostatniego użycia. Wylogowanie odwołuje sesję, usunięcie konta usuwa wszystkie jego sesje. Ciasteczko httpOnly oraz token dla przeglądarek blokujących ciasteczka w ramce. Prywatnych danych konta nie przywracamy z cache.
- Wgrywanie MP3/WAV/OGG do 30 MB, odtwarzanie w przeglądarce, pauza, przewijanie HTTP Range, kolejka, głośność.
- Playlisty publiczne i prywatne, zmiana kolejności i polubienia.
- Grupy muzyczne, dołączanie/opuszczanie, krótkie posty, udostępnianie publicznych playlist.
- Komentarze i odpowiedzi, profile, obserwowanie, teksty i statystyki.
- **Odznaki** — cztery ręcznie nadawane odznaki: **OG**, **Twórcy Koczowiska**, **Kocz**, **Dziadzia**. Każda wyświetla się jako kropka w losowym odcieniu szarości (zapisanym na stałe) z nazwą obok — na profilu, przy komentarzach, postach i członkach grup. Nadaje się je w **Ustawieniach** po podaniu hasła do odznak; hasło jest sprawdzane tylko na serwerze i nigdy nie trafia do przeglądarki. Można nadać odznakę sobie lub innemu użytkownikowi po loginie i usunąć ją w każdej chwili.
- PWA: manifest, instalacja z przeglądarki i anonimowy ekran braku połączenia. Service worker nie zapisuje odpowiedzi API, danych kont ani plików muzycznych.

Konta, grupy i utwory nie są generowane automatycznie. Użytkownicy tworzą własne dane. Wgrane utwory są dostępne w bibliotece tej instancji; dodawaj tylko legalnie udostępniane nagrania. Prywatność playlisty nie jest szyfrowaniem pliku audio.

## Oryginalny obraz KOCZ

Znak można wgrać w polu na stronie głównej lub w Ustawieniach. Serwer zapisuje PNG/JPEG/WebP bez obróbki, a interfejs nie kadruje znaku. Załącznik z wiadomości nie jest automatycznie plikiem w repozytorium — do czasu wgrania widoczny jest neutralny napis KOCZ. Plik `public/icon.svg` oraz ikony PWA są neutralnymi ikonami technicznymi, nie przerysowaną wersją rysunku.

## Dane

- `src/db/schema.ts`: konta, sesje, utwory, playlisty, grupy, komentarze, statystyki.
- `uploads/`: pliki audio, okładki, awatary i oryginalny znak; wymaga trwałego dysku.
- `.env`: połączenie PostgreSQL. Nie publikuj tego pliku.
- `scripts/accounts.ts`: odczyt liczników i jawna operacja administracyjna usunięcia kont. Nie jest wywoływana automatycznie.

## Testy

```bash
npx playwright install chromium
node scripts/browser-test.mjs
node scripts/e2e-test.mjs
```

Z FFmpeg: dodaj `--all-formats`, aby testować dekodowanie prawdziwych MP3 i OGG. Testy tworzą i usuwają własne konta, nie usuwają kont użytkownika ani obrazu marki. `npx tsx scripts/accounts.ts` pokazuje liczniki rekordów bez ujawniania adresów e-mail.

## Desktop i wdrożenie

Pliki `desktop/main.cjs` i skrypty EXE pozostają jako opcjonalny klient działającego serwera. Paczka Electron sama w sobie **nie zawiera PostgreSQL ani backendu Next.js** — do pracy online potrzebuje adresu wspólnego serwera. Budowanie Windows EXE nie jest wykonywane w linuksowym podglądzie.

**Czy potrzebujesz hostingu?** Do korzystania przez inne osoby — tak. Sam EXE wysłany bez serwera nie zadziała. Konkretne warianty, koszty i sposób wysłania paczki opisuje [INSTRUKCJA_WINDOWS.md](INSTRUKCJA_WINDOWS.md).

Pełne funkcje kont i strumieniowania wymagają połączenia z serwerem. To nie jest samodzielny odtwarzacz offline. Dla publicznego wdrożenia przygotuj HTTPS, trwałą bazę i katalog uploads, backupy oraz limity żądań.
