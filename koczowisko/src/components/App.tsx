"use client";
import React, { useState } from "react";
import { PlayerProvider, StoreProvider, useStore } from "./ctx";
import { Sidebar } from "./Sidebar";
import { BrowserBar } from "./BrowserBar";
import { PlayerBar, SidePanel } from "./Player";
import { ModalHost } from "./Modals";
import { I, KoczMark } from "./ui";
import { HomeView, LibraryView, PlaylistView, SearchView } from "./Views1";
import { GroupsView, GroupDetailView, LyricsView, ProfileView, SettingsView, StatsView } from "./Views2";\nimport { AdminView, FriendsView } from "./CommunityViews";

function ViewSwitch() {
  const store = useStore();
  const v = store.view;
  switch (v.name) {
    case "home": return <HomeView />;
    case "search": return <SearchView initial={v.initial ?? ""} />;
    case "library": return <LibraryView />;
    case "groups": return <GroupsView />;
    case "group": return <GroupDetailView id={v.id} />;\n    case "friends": return <FriendsView />;\n    case "admin": return <AdminView />;
    case "stats": return <StatsView />;
    case "lyrics": return <LyricsView />;
    case "settings": return <SettingsView />;
    case "playlist": return <PlaylistView id={v.id} />;
    case "profile": return <ProfileView username={v.username} />;
    default: return <HomeView />;
  }
}

function Toasts() {
  const store = useStore();
  return (
    <div className="fixed bottom-28 right-4 z-[95] space-y-2 w-80 max-w-[calc(100vw-2rem)]">
      {store.toasts.map((t) => (
        <div key={t.id} className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm shadow-xl shadow-black/15 backdrop-blur koc-pop ${t.kind === "err" ? "border-red-500/40 bg-red-50 text-red-900" : "border-[var(--line2)] bg-[var(--panel)]/95 text-[var(--text)]"}`}>
          <span className={t.kind === "err" ? "text-red-600 mt-0.5" : "text-[var(--accent)] mt-0.5"}>{t.kind === "err" ? I.x({ size: 15 }) : I.check({ size: 15 })}</span>
          <span className="min-w-0">{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

function Shell() {
  const store = useStore();
  const [mobileNav, setMobileNav] = useState(false);
  const [panel, setPanel] = useState<"queue" | "history" | null>(null);

  return (
    <div className="h-dvh flex flex-col overflow-hidden">
      <div className="noise-layer" aria-hidden />
      <BrowserBar />
      {!store.online && (
        <div className="shrink-0 flex items-center justify-center gap-2 bg-[#ecece8] border-b border-[#c8c9c7] text-[#50565d] text-xs py-1.5 px-4">
          {I.library({ size: 14 })} Brak połączenia z serwerem. Zapisywanie zmian wymaga połączenia; dane odświeżą się po jego odzyskaniu.
        </div>
      )}
      <div className="md:hidden shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-[var(--line)] bg-[var(--panel)]/90 backdrop-blur">
        <button type="button" onClick={() => setMobileNav(true)} className="p-2 -ml-2 text-[var(--muted)] hover:text-[var(--text)] transition-colors cursor-pointer" aria-label="Menu">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h10" /></svg>
        </button>
        <div className="flex items-center gap-2 font-display font-extrabold tracking-tight"><KoczMark className="w-10 h-8 object-contain rounded-sm" alt="" /> KOCZOWISKO</div>
        <span className="w-8" />
      </div>
      <div className="flex-1 flex min-h-0">
        <div className="hidden md:flex h-full"><Sidebar /></div>
        {mobileNav && (
          <div className="fixed inset-0 z-[80] flex md:hidden" onClick={() => setMobileNav(false)}>
            <div className="absolute inset-0 bg-black/70 koc-fade" />
            <div className="relative h-full koc-pop" onClick={(e) => e.stopPropagation()}><Sidebar mobile onNavigate={() => setMobileNav(false)} /></div>
          </div>
        )}
        <main className="flex-1 min-w-0 overflow-y-auto">
          <div key={vKey(store.view)} className="koc-view-enter px-4 md:px-8 lg:px-10 py-6 md:py-8 max-w-[1240px] mx-auto pb-16">
            {store.loading ? (
              <div className="flex flex-col items-center justify-center py-32 gap-4 text-[var(--muted)]">
                <KoczMark className="w-32 h-24 object-contain rounded-md" alt="KOCZ" />
                <p className="text-sm">Otwieramy Twój zeszyt…</p>
              </div>
            ) : <ViewSwitch />}
          </div>
        </main>
      </div>
      <PlayerBar onOpenPanel={setPanel} />
      {panel && <SidePanel kind={panel} onClose={() => setPanel(null)} />}
      <ModalHost />
      <Toasts />
    </div>
  );
}

function vKey(v: { name: string; id?: string; username?: string }): string {
  return `${v.name}:${v.id ?? v.username ?? ""}`;
}

export default function App() {
  return <StoreProvider><PlayerProvider><Shell /></PlayerProvider></StoreProvider>;
}
