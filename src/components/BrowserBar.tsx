"use client";
import { useEffect, useState } from "react";

interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function BrowserBar() {
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const [help, setHelp] = useState(false);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    setStandalone(window.matchMedia("(display-mode: standalone)").matches);
    const onPrompt = (event: Event) => { event.preventDefault(); setInstall(event as InstallEvent); };
    const onInstalled = () => { setStandalone(true); setInstall(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if ("serviceWorker" in navigator && window.isSecureContext) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => { /* works online without SW */ });
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  return (
    <header className="shrink-0 relative z-40 border-b border-[var(--line)] bg-[var(--panel)] px-4 py-2 text-xs text-[var(--muted)]">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 font-semibold text-[var(--text)]"><span aria-hidden>◉</span> Koczowisko Web <span className="hidden sm:inline font-normal text-[var(--muted)]">· bez instalacji EXE</span></span>
        <div className="flex items-center gap-3">
          <a href="/web" target="_blank" rel="noopener noreferrer" className="hover:underline focus-visible:outline-2" title="Otwórz pełną wersję poza ramką podglądu">Nowa karta ↗</a>
          {!standalone && <button type="button" className="cursor-pointer rounded border border-[var(--line2)] px-2.5 py-1 hover:bg-[var(--hover)]" aria-expanded={help} onClick={async () => {
            if (install) {
              await install.prompt();
              await install.userChoice;
              setInstall(null);
            } else { setHelp((v) => !v); }
          }}>{install ? "Zainstaluj aplikację" : "Dodaj do pulpitu"}</button>}
        </div>
      </div>
      {help && <div className="mt-2 max-w-2xl leading-relaxed" role="status">
        W Chrome lub Edge otwórz menu przeglądarki i wybierz „Zainstaluj Koczowisko” albo „Zainstaluj stronę jako aplikację”.
        Na iPhonie: Safari → Udostępnij → Do ekranu początkowego. W podglądzie najpierw wybierz „Nowa karta”.
        Instalacja jest opcjonalna — wszystkie funkcje działają też w zwykłej karcie, z połączeniem z serwerem.
      </div>}
    </header>
  );
}
