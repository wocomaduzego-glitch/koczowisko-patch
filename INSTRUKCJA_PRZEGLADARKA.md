# Koczowisko Web — wersja przeglądarkowa

## Korzystanie w podglądzie

Otwórz adres podglądu z końcówką **`/web`**. Jest to pełny frontend korzystający z tego samego backendu PostgreSQL co strona główna. Nie wymaga Electron, instalatora ani EXE.

- „Nowa karta ↗” otwiera aplikację poza ramką podglądu.
- Przy pierwszym użyciu wybierz **Dołącz do Koczowiska → Załóż konto**. Nie ma kont demo.
- Logowanie działa nazwą użytkownika albo e-mailem i hasłem.
- **Grupy → Nowa grupa** tworzy grupę i otwiera ją. Inne konto może dołączyć i publikować krótkie posty.
- **Twoja Biblioteka → Dodaj pliki** przyjmuje własne pliki MP3, WAV, OGG (do 30 MB).
- Utwórz playlistę przyciskiem `+` w panelu bocznym. Publiczną playlistę można udostępnić w grupie.
- **Odznaki** (OG, Twórcy Koczowiska, Kocz, Dziadzia) nadaje się ręcznie w **Ustawieniach → Odznaki** po podaniu hasła do odznak. Hasło (`BADGE_ADMIN_PASSWORD`, domyślnie ustawione) jest sprawdzane wyłącznie na serwerze. Odznaka to kropka w losowym odcieniu szarości z nazwą, widoczna na profilu, przy komentarzach, postach i w grupach. Możesz nadać ją sobie lub wskazanej osobie i usunąć.
- Sesja pozostaje po odświeżeniu i ponownym otwarciu przeglądarki, o ile nie usuniesz danych witryny i nie używasz nietrwałego trybu prywatnego. Sesja wygasa po 180 dniach bezczynności.
- Wylogowanie odwołuje konkretną sesję na serwerze. Usunięcie konta odwołuje wszystkie jego sesje.

## Własny komputer — bez EXE

1. Pobierz projekt. Zainstaluj Node.js 22 LTS lub nowszy i PostgreSQL. Uruchom usługę PostgreSQL i utwórz pustą bazę `app_db`.
2. Skopiuj `.env.example` do `.env`; wpisz własny `DATABASE_URL` (hasło z instalacji PostgreSQL). Hasła zawierające znaki `@`, `:` lub `/` wymagają kodowania URL.
3. Windows: uruchom **START_W_PRZEGLADARCE.bat**. Skrypt instaluje zależności, nakłada schemat, buduje aplikację i otwiera domyślną przeglądarkę pod `http://127.0.0.1:3000/web`. Nie uruchamia automatycznie PostgreSQL — baza musi już działać.
4. Alternatywnie w terminalu:

```bash
npm install
npx drizzle-kit push
npm run build
node scripts/start-browser.mjs
```

Pozostaw terminal serwera otwarty. Ctrl+C go zatrzymuje. Baza i katalog `uploads/` pozostają na dysku; nie usuwaj ich, jeśli chcesz zachować konta i muzykę. Aplikacja nie seeduje danych przy uruchomieniu i nigdy automatycznie nie resetuje kont.

## Opcjonalna instalacja z przeglądarki

Na HTTPS (lub localhost) dostępny jest manifest PWA i service worker. W Chrome/Edge użyj menu „Zainstaluj stronę jako aplikację”; na iOS Safari: Udostępnij → Do ekranu początkowego. W pasku aplikacji jest przycisk instalacji lub instrukcja, gdy dana przeglądarka nie udostępnia natywnego monitu.

Instalacja to tylko wygodne osobne okno. Konta, grupy i strumieniowanie muzyki nadal wymagają działającego serwera i połączenia. Service worker przechowuje jedynie anonimowy ekran offline — **nie buforuje sesji, prywatnych playlist, odpowiedzi API ani muzyki**.

## Wspólna platforma online

Uruchom Next.js oraz PostgreSQL na wspólnym serwerze. Użytkownicy muszą używać tego samego adresu HTTPS. Ustaw `DATABASE_URL`, wykonaj `npx drizzle-kit push`, następnie `npm run build` i `npm run start`. Potrzebny jest trwały katalog `uploads/` na pliki oraz trwała baza na dane i sesje. Wszystkie instancje serwera muszą korzystać z tej samej bazy oraz przestrzeni plików. Sesje są hashowane w PostgreSQL — nie zależą od pliku klucza ani restartu procesu. Dla HTTPS za proxy można ustawić `COOKIE_SECURE=true`.

To wersja do własnego wdrożenia; nie obejmuje administracji publiczną usługą, moderacji praw do nagrań, odzyskiwania hasła e-mailem ani automatycznych kopii zapasowych. Przed publiczną publikacją skonfiguruj HTTPS, limity żądań i backupy.

## Powtarzanie testów

Przy działającym lokalnym serwerze:

```bash
npx playwright install chromium
# Na Linuksie przy braku bibliotek: npx playwright install-deps chromium
node scripts/browser-test.mjs
node scripts/e2e-test.mjs
```

Aby przetestować także prawdziwe MP3 i OGG, zainstaluj FFmpeg i dodaj `--all-formats` do obu komend testowych. Testy generują krótki własny ton, tworzą tymczasowe konta z losowymi loginami i usuwają tylko te konta po zakończeniu. Nie podmieniają obrazu KOCZ.

Liczby rekordów można bezpiecznie odczytać: `npx tsx scripts/accounts.ts`.
**Nie uruchamiaj opcji `--delete-all-accounts`, jeśli chcesz zachować konta** — to jawne, jednorazowe narzędzie administracyjne do ich trwałego usunięcia. Nie jest dostępne przez HTTP i nie jest uruchamiane podczas startu aplikacji.
