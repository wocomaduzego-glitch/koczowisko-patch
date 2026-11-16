# EXE, hosting i wysyłanie aplikacji znajomym — konkretnie

## Naprawione: błąd `'d' is not recognized`, `'errorlevel' is not recognized`

To **nie brak Node.js** — mimo że skrypt tak pisał. Przyczyna: pliki `.bat` miały końce linii
z Linuksa (LF) i polskie znaki, więc `cmd.exe` rozbijał każdą linię na pojedyncze litery.
Naprawione w tej wersji:

- wszystkie `*.bat` są teraz w **czystym ASCII z CRLF** (bez BOM, bez polskich znaków),
- `.gitattributes` wymusza CRLF dla `*.bat`, `*.ps1`, `*.cmd` przy każdym pobraniu repozytorium,
- logika budowania przeniesiona do **`scripts/build-exe.mjs`** — Node zamiast batcha, więc nie ma czego zepsuć,
- dodany wariant **`ZBUDUJ_EXE.ps1`** dla PowerShell.

Jeśli widziałeś ten błąd na wcześniej pobranej paczce, pobierz pliki ponownie albo uruchom bezpośrednio w terminalu:

```bat
cd /d C:\sciezka\do\projektu
node scripts\build-exe.mjs
```

Sprawdź też, że Node faktycznie jest w PATH — otwórz **nowe** okno cmd po instalacji i wpisz:

```bat
node -v
npm -v
```

Jeśli `node` nie jest rozpoznawany: reinstalacja Node.js z opcją **Add to PATH** i ponowne otwarcie terminala.
Jeśli skrypt uruchamiasz bezpośrednio z okna ZIP (bez rozpakowania), rozpakuj cały folder na dysk.

Potwierdzone: `node scripts/build-exe.mjs` buduje działającą paczkę `Koczowisko-win32-x64`
z prawdziwym `Koczowisko.exe` (Electron, Windows x64, ok. 360 MB po rozpakowaniu).

## Najkrótsza odpowiedź

- **Sam plik `Koczowisko.exe` nie wystarczy innej osobie.** To tylko okno aplikacji (Electron). Nie zawiera serwera Koczowiska, bazy PostgreSQL, kodu Next.js ani plików muzyki. Bez działającego serwera pokaże komunikat „brak połączenia z serwerem”.
- **Jeśli chcesz, żeby ktoś inny korzystał z aplikacji — potrzebujesz hostingu** (serwer + baza + trwały dysk na pliki). Wtedy każdy wchodzi przez przeglądarkę pod Wasz adres. EXE jest tylko wygodnym oknem do tego samego serwera i wysyłasz go **razem z adresem serwera**.
- **Bez hostingu** aplikacja działa tylko lokalnie na Twoim komputerze, w folderze projektu, przy działającym PostgreSQL.

## Trzy realne scenariusze

### 1. Tylko Ty, na swoim komputerze (bez hostingu, 0 zł)

Wymagania: Node.js 22+, PostgreSQL, projekt na dysku.

1. Uzupełnij `.env` (adres bazy PostgreSQL).
2. Uruchom `START_W_PRZEGLADARCE.bat` (wersja w przeglądarce) albo `START_KOCZOWISKO.bat` (okno aplikacji).
3. Działa tylko u Ciebie, dopóki komputer i serwer są włączone. Nikt z zewnątrz nie ma dostępu.

### 2. Wspólne konto, grupy i playlisty dla kilku osób (zalecane, potrzebny hosting)

Serwer i baza muszą stać w jednym miejscu w internecie. Potrzebujesz:

- **bazy PostgreSQL** (np. Neon, Supabase, Railway — darmowe plany wystarczą do testów),
- **hostingu Node.js** dla aplikacji (Railway, Render, Fly.io, VPS, własny serwer),
- **HTTPS** (hosting zwykle daje go automatycznie),
- **trwałego dysku na katalog `uploads/`** — inaczej wgrane MP3/WAV/OGG i obrazek znikną po restarcie.

Konfiguracja na hostingu:

```
DATABASE_URL=postgresql://użytkownik:hasło@host:5432/baza
# opcjonalnie: COOKIE_SECURE=true (jeśli HTTPS nie jest wykrywane automatycznie)
```

Kolejność: `npm install` → `npx drizzle-kit push` → `npm run build` → `npm run start`.
Sprawdź `https://twoj-adres/api/health` → powinno zwrócić `{"ok":true}`.

Koszt: od 0 zł (darmowe plany z ograniczeniami, serwer może „zasypiać”) do ok. 20–40 zł/mies. za mały VPS z bazą i dyskiem. Darmowe plany często nie mają trwałego dysku — wtedy pliki muzyki znikają.

### 3. Wysyłanie gotowego EXE znajomym

Po hostingu z punktu 2:

1. Zbuduj paczkę na Windows: dwuklik `ZBUDUJ_EXE_WINDOWS.bat`.
2. Wejdź do `dist-desktop\release\Koczowisko-win32-x64`.
3. Otwórz plik **`koczowisko-url.txt`** i wpisz w nim swój adres, np. `https://koczowisko.example.pl` (bez spacji), zapisz.
4. Spakuj **cały folder** `Koczowisko-win32-x64` do ZIP i wyślij.
5. Odbiorca rozpakowuje ZIP i uruchamia `Koczowisko.exe`. Program łączy się z Twoim serwerem.

Czego odbiorca **nie** potrzebuje w tym wariancie: Node.js, PostgreSQL, projektu, instalatora. Potrzebuje internetu.

Czego **nie** wysyłaj: pliku `.env` (ma hasło do bazy), katalogu projektu, bazy danych.

Uwaga: w folderze jest `JAK_PODLACZYC_SERWER.txt` z tą instrukcją. Bez wpisanego adresu program pokaże błąd i zaproponuje otwarcie w przeglądarce.

## Dlaczego nie ma „jednego EXE, który działa offline u każdego”

Aplikacja to serwer Next.js + PostgreSQL + pliki na dysku. Aby zrobić w pełni samodzielny EXE, trzeba by dołączyć środowisko Node, bazę danych i wszystkie pliki — to inne, dużo większe opakowanie (setki MB, aktualizacje, kopie zapasowe). **Ten projekt tego nie zawiera** i nie udaję, że zawiera.

Alternatywy bez hostingu dla drugiej osoby:

- **wersja przeglądarkowa** — jeśli udostępnisz komputer w sieci lokalnej, druga osoba wejdzie pod `http://twoj-ip:3000/web` (firewall musi przepuścić port; tylko w tej samej sieci),
- **hosting z punktu 2** — jedyne sensowne rozwiązanie przez internet.

## Bezpieczeństwo i porządek

- `npx tsx scripts/accounts.ts` tylko pokazuje liczniki. `--delete-all-accounts` trwale usuwa **wszystkie** konta i ich dane — używaj świadomie.
- Wgrywaj wyłącznie nagrania, do których masz prawa. Publiczny hosting oznacza publiczne udostępnianie treści.
- Zrób kopię zapasową bazy i katalogu `uploads/` przed aktualizacją hostingu.
- Aplikacja nie ma odzyskiwania hasła e-mailem ani panelu administratora.

## Pierwsze kroki po uruchomieniu

1. Załóż konto (nie ma kont demo).
2. Wgraj swój obrazek KOCZ na stronie głównej lub w Ustawieniach.
3. Dodaj pliki: **Twoja Biblioteka → Dodaj pliki**.
4. Twórz playlisty (`+` przy „Twoje playlisty”) i grupy (**Grupy → Nowa grupa**).
