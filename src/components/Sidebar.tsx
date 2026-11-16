"use client";
import { useStore } from "./ctx";
import { Avatar, Btn, I, KoczMark } from "./ui";
import type { View } from "@/lib/types";

const NAV: { view: View; label: string; icon: (p?: { size?: number; className?: string }) => React.ReactNode }[] = [
  { view: { name: "home" }, label: "Start", icon: I.home },
  { view: { name: "search" }, label: "Wyszukaj", icon: I.search },
  { view: { name: "library" }, label: "Twoja Biblioteka", icon: I.library },
  { view: { name: "groups" }, label: "Grupy", icon: I.users },
  { view: { name: "friends" }, label: "Znajomi", icon: I.users },
  { view: { name: "stats" }, label: "Statystyki", icon: I.chart },
  { view: { name: "lyrics" }, label: "Teksty", icon: I.book },
  { view: { name: "settings" }, label: "Ustawienia", icon: I.gear },
];

export function Sidebar({ mobile, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  const store = useStore();
  const { view, user, settings, badges } = store;
  const active = (v: View) => view.name === v.name;

  return (
    <aside
      className={`flex flex-col h-full bg-[var(--panel)] border-r border-[var(--line)] ${
        mobile ? "w-[290px] max-w-[85vw]" : "w-[264px] xl:w-[290px]"
      } shrink-0`}
    >
      <button
        type="button"
        onClick={() => {
          store.setView({ name: "home" });
          onNavigate?.();
        }}
        className="flex items-center gap-3 px-5 pt-5 pb-4 cursor-pointer group"
      >
        <div className="relative w-14 h-11 rounded-md overflow-hidden border border-[var(--line2)] bg-white flex items-center justify-center">
          <KoczMark className="w-full h-full object-contain" alt="KOCZ" />
        </div>
        <div className="text-left">
          <div className="font-display font-extrabold text-[17px] leading-none tracking-tight">KOCZOWISKO</div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--accent2)] mt-1">szkic dźwięku</div>
        </div>
      </button>

      <nav className="px-3 space-y-0.5">
        {[...NAV.filter((n) => !(n.view.name === "groups" && !settings.social) && !(n.view.name === "friends" && !user)), ...(badges.some((b) => b.badge === "tworcy") ? [{ view: { name: "admin" } as View, label: "Administracja", icon: I.gear }] : [])].map((n) => {
          const isActive = active(n.view);
          return (
            <button
              key={n.label}
              type="button"
              aria-label={n.label}
              aria-current={isActive ? "page" : undefined}
              onClick={() => {
                store.setView(n.view);
                onNavigate?.();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer ${
                isActive ? "bg-[var(--hover)] text-[var(--text)]" : "text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--hover)]"
              }`}
            >
              <span className={isActive ? "text-[var(--accent2)]" : ""}>{n.icon({ size: 19 })}</span>
              {n.label}
              {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent)" }} />}
            </button>
          );
        })}
      </nav>

      <div className="mt-5 px-3 flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between px-2 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--muted2)]">Twoje playlisty</span>
          <button
            type="button"
            title="Nowa playlista"
            onClick={() => (user ? store.openModal({ type: "playlist-create" }) : store.openModal({ type: "auth" }))}
            className="p-1 rounded-md text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors cursor-pointer"
          >
            {I.plus({ size: 15 })}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto pr-1 space-y-0.5">
          {store.myPlaylists.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                store.setView({ name: "playlist", id: p.id });
                onNavigate?.();
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm truncate transition-colors cursor-pointer ${
                view.name === "playlist" && view.id === p.id ? "bg-[var(--hover)]" : "hover:bg-[var(--hover)]"
              } text-[var(--muted)] hover:text-[var(--text)]`}
            >
              <span className="w-4 text-[var(--muted2)] shrink-0">{I.music({ size: 13 })}</span>
              <span className="truncate">{p.name}</span>
            </button>
          ))}
          {!user && <p className="px-3 py-2 text-xs text-[var(--muted2)]">Zaloguj się, aby tworzyć playlisty.</p>}
        </div>
      </div>

      <div className="p-3 border-t border-[var(--line)]">
        {user ? (
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              className="flex items-center gap-2.5 flex-1 min-w-0 rounded-lg px-2 py-1.5 hover:bg-[var(--hover)] transition-colors cursor-pointer"
              onClick={() => store.setView({ name: "profile", username: user.username })}
              title="Mój profil"
            >
              <Avatar user={user} size={32} />
              <div className="min-w-0 text-left">
                <div className="text-sm font-semibold truncate">{user.displayName}</div>
                <div className="text-[11px] text-[var(--muted)] truncate">@{user.username}</div>
              </div>
            </button>
            <button
              type="button"
              title="Wyloguj się"
              onClick={() => store.logout()}
              className="p-2 rounded-lg text-[var(--muted)] hover:text-red-300 hover:bg-[var(--hover)] transition-colors cursor-pointer"
            >
              {I.logout({ size: 17 })}
            </button>
          </div>
        ) : (
          <Btn kind="primary" className="w-full" onClick={() => store.openModal({ type: "auth" })}>
            {I.user({ size: 16 })} Dołącz do Koczowiska
          </Btn>
        )}
      </div>
    </aside>
  );
}
