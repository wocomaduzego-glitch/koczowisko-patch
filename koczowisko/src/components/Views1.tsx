"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { api, usePlayer, useStore } from "./ctx";
import type { Playlist, Track } from "@/lib/types";
import { fmtLong } from "@/lib/types";
import {
  Btn, Cover, Empty, I, IconBtn, KoczMark, PlaylistCard,
  SectionHead, SketchField, TrackCard, TrackRow,
} from "./ui";

/* ================= START ================= */

export function HomeView() {
  const store = useStore();
  const player = usePlayer();
  const hour = new Date().getHours();
  const greet = hour < 6 ? "Dobranoc" : hour < 12 ? "Dzień dobry" : hour < 18 ? "Miłego dnia" : "Dobry wieczór";
  const recent = useMemo(() => [...store.tracks].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8), [store.tracks]);
  const artists = useMemo(() => [...new Set(store.tracks.map((t) => t.artist))].slice(0, 10), [store.tracks]);
  const toplists = useMemo(() => [...store.publicPlaylists].sort((a, b) => b.likes - a.likes).slice(0, 6), [store.publicPlaylists]);

  return (
    <div className="space-y-10">
      <section className="koc-paper-hero relative overflow-hidden rounded-2xl border border-[var(--line2)] bg-gradient-to-br from-[var(--panel2)] via-[var(--panel)] to-[var(--bg2)] p-6 md:p-9">
        <SketchField />
        <div className="absolute -right-24 -bottom-32 w-[420px] h-[420px] rounded-full opacity-20 pointer-events-none" style={{ background: "radial-gradient(circle, var(--accent), transparent 65%)" }} />
        <div className="relative flex flex-col md:flex-row md:items-center gap-7">
          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--accent2)] mb-4">
              {I.edit({ size: 13 })} Twój zeszyt dźwięku
            </div>
            <h1 className="font-display font-extrabold text-3xl md:text-5xl leading-[1.05]">
              {greet},<br />
              <span style={{ background: "linear-gradient(90deg, var(--accent), var(--accent2))", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
                {store.user ? store.user.displayName : "słuchaczu"}
              </span>
            </h1>
            <p className="mt-3 text-sm md:text-base text-[var(--muted)] max-w-md">
              Zapisz swoją muzykę po swojemu. Playlisty, teksty i ulubione utwory — wszystko w jednym szkicu KOCZ.
            </p>
            <div className="flex flex-wrap gap-2.5 mt-5">
              {recent.length > 0 && (
                <Btn kind="primary" onClick={() => player.play(recent, 0, "Twoje Koczowisko")}>
                  {I.play({ size: 16 })} Odtwórz bibliotekę
                </Btn>
              )}
              <Btn kind="ghost" onClick={() => store.setView({ name: "search" })}>
                {I.search({ size: 15 })} Przeglądaj bibliotekę
              </Btn>
            </div>
          </div>
          <div className="relative shrink-0 self-center rounded-xl border border-[var(--line2)] bg-white p-3 shadow-sm" aria-label="Oryginalny obraz KOCZ">
            <KoczMark uploadable className="w-56 md:w-72 h-44 md:h-56 object-contain" alt="Oryginalny obraz KOCZ" />
          </div>
        </div>
      </section>

      {player.history.length > 0 && (
        <section>
          <SectionHead title="Wracamy do…" sub="Ostatnio odtwarzane utwory" />
          <div className="flex gap-3 overflow-x-auto pb-2">
            {player.history.slice(0, 8).map((t) => (
              <div key={t.id} className="w-40 shrink-0"><TrackCard track={t} context={player.history.slice(0, 8)} label="Ostatnio słuchane" /></div>
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionHead title="Do pierwszego odsłuchu" sub="Najświeższe utwory w bibliotece" />
        {recent.length === 0 ? (
          <Empty title="Biblioteka jest pusta" sub="Dodaj swoje pliki MP3, WAV lub OGG, aby rozpocząć słuchanie." action={<UploadButton />} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {recent.map((t) => <TrackCard key={t.id} track={t} context={recent} label="Do odsłuchu" onOpen={() => store.openModal({ type: "track-detail", trackId: t.id })} />)}
          </div>
        )}
      </section>

      {store.publicPlaylists.length > 0 && (
        <section>
          <SectionHead title="Playlisty społeczności" sub="Publiczne selekcje z całego Koczowiska" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {toplists.map((p) => <PlaylistCard key={p.id} playlist={p} onClick={() => store.setView({ name: "playlist", id: p.id })} />)}
          </div>
        </section>
      )}

      <section>
        <SectionHead title="Wykonawcy w zeszycie" sub="Przejdź szybko do swoich ulubionych brzmień" />
        <div className="flex flex-wrap gap-2">
          {artists.map((a) => (
            <button key={a} type="button" onClick={() => store.setView({ name: "search", initial: a })} className="px-4 py-2 rounded-full border border-[var(--line2)] text-sm font-medium text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--accent)] hover:bg-[var(--accent)]/10 transition-all cursor-pointer">
              {a}
            </button>
          ))}
        </div>
      </section>

      {store.settings.social && store.groups.length > 0 && (
        <section>
          <SectionHead title="Twoje grupy" sub="Wspólne playlisty i krótkie posty" action={<Btn kind="ghost" onClick={() => store.setView({ name: "groups" })}>Wszystkie grupy</Btn>} />
          <div className="grid md:grid-cols-3 gap-4">
            {store.groups.slice(0, 3).map((g) => (
              <button key={g.id} type="button" onClick={() => store.setView({ name: "group", id: g.id })} className="koc-card text-left rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 cursor-pointer">
                <div className="font-display font-bold">{g.name}</div>
                <div className="text-xs text-[var(--muted)] mt-1 line-clamp-2">{g.description || "Grupa muzyczna"}</div>
                <div className="flex items-center gap-3 mt-3 text-[11px] text-[var(--muted2)]">
                  <span className="flex items-center gap-1">{I.users({ size: 12 })} {g.memberCount}</span>
                  <span className="flex items-center gap-1">{I.music({ size: 12 })} {g.postCount} postów</span>
                  {g.isMember && <span className="text-[var(--accent2)] font-semibold">• jesteś w grupie</span>}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function UploadButton({ small }: { small?: boolean }) {
  const store = useStore();
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input ref={ref} type="file" accept=".mp3,.wav,.ogg,audio/mpeg,audio/wav,audio/ogg" multiple className="hidden" onChange={(e) => {
        const files = Array.from(e.target.files ?? []);
        if (files.length) store.openModal({ type: "upload-files", files });
        e.target.value = "";
      }} />
      <Btn kind={small ? "soft" : "primary"} onClick={() => (store.user ? ref.current?.click() : store.openModal({ type: "auth" }))}>
        {I.upload({ size: 15 })} {small ? "Dodaj pliki" : "Dodaj swoje pliki muzyczne"}
      </Btn>
    </>
  );
}

/* ================= WYSZUKAJ ================= */

export function SearchView({ initial = "" }: { initial?: string }) {
  const store = useStore();
  const [q, setQ] = useState(initial);
  useEffect(() => setQ(initial), [initial]);
  const query = q.trim().toLowerCase();
  const tracks = useMemo(() => query ? store.tracks.filter((t) => [t.title, t.artist, t.album].some((s) => s.toLowerCase().includes(query))) : [], [query, store.tracks]);
  const pls = useMemo(() => query ? [...store.myPlaylists, ...store.publicPlaylists]
    .filter((p, i, a) => a.findIndex((x) => x.id === p.id) === i)
    .filter((p) => p.name.toLowerCase().includes(query) || !p.isPrivate) : [], [query, store.myPlaylists, store.publicPlaylists]);
  const artists = useMemo(() => [...new Set(store.tracks.filter((t) => t.artist.toLowerCase().includes(query)).map((t) => t.artist))].slice(0, 6), [query, store.tracks]);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display font-extrabold text-3xl mb-4">Wyszukaj</h1>
        <div className="relative max-w-xl">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]">{I.search({ size: 18 })}</span>
          <input ref={inputRef} className="koc-search-input" placeholder="Utwór, wykonawca, album…" value={q} onChange={(e) => setQ(e.target.value)} />
          {q && <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--text)] cursor-pointer" onClick={() => setQ("")}>{I.x({ size: 16 })}</button>}
        </div>
      </div>
      {!query && <Empty icon={I.search({ size: 34 })} title="Szukaj w swoim zeszycie" sub="Wpisz fragment tytułu, nazwę wykonawcy albo albumu. Znajdziesz też playlisty." />}
      {artists.length > 0 && (
        <section><SectionHead title="Wykonawcy" /><div className="flex flex-wrap gap-2">{artists.map((a) => <button key={a} type="button" onClick={() => setQ(a)} className="px-4 py-2 rounded-full border border-[var(--line2)] text-sm font-medium text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--accent)] transition-all cursor-pointer">{a}</button>)}</div></section>
      )}
      {tracks.length > 0 && (
        <section><SectionHead title="Utwory" sub={`${tracks.length} wyników`} /><div className="space-y-0.5">{tracks.slice(0, 30).map((t, i) => <TrackRow key={t.id} track={t} index={i} context={tracks} label="Wyniki wyszukiwania" showAlbum />)}</div></section>
      )}
      {pls.length > 0 && (
        <section><SectionHead title="Playlisty" /><div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">{pls.slice(0, 6).map((p) => <PlaylistCard key={p.id} playlist={p} onClick={() => store.setView({ name: "playlist", id: p.id })} />)}</div></section>
      )}
      {query && tracks.length === 0 && pls.length === 0 && artists.length === 0 && <Empty title={`Nic nie znaleziono dla „${q}”`} sub="Spróbuj krótszego fragmentu albo innego słowa." />}
    </div>
  );
}

/* ================= BIBLIOTEKA ================= */

export function LibraryView() {
  const store = useStore();
  const [tab, setTab] = useState<"playlists" | "liked" | "added">("playlists");
  const added = useMemo(() => store.tracks.filter((t) => t.addedBy === store.user?.id), [store.tracks, store.user]);
  const liked = store.likedTracks;
  const likedDur = liked.reduce((s, t) => s + t.duration, 0);

  return (
    <div className="space-y-6">
      <SectionHead title="Twoja Biblioteka" sub={store.user ? `Zalogowano jako ${store.user.displayName}` : "Biblioteka publiczna + Twoje konto po zalogowaniu"} action={<UploadButton small />} />
      <div className="flex gap-1.5 p-1 bg-[var(--bg2)] rounded-xl w-fit">
        {([["playlists", "Playlisty"], ["liked", "Polubione"], ["added", "Dodane przeze mnie"]] as const).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${tab === k ? "bg-[var(--panel2)] text-[var(--text)] shadow" : "text-[var(--muted)] hover:text-[var(--text)]"}`}>{label}</button>
        ))}
      </div>

      {tab === "playlists" && (store.myPlaylists.length === 0 ? (
        <Empty icon={I.library({ size: 34 })} title="Brak playlist" sub="Stwórz pierwszą playlistę i zapisz w niej swój muzyczny szkic." action={<Btn kind="primary" onClick={() => (store.user ? store.openModal({ type: "playlist-create" }) : store.openModal({ type: "auth" }))}>{I.plus({ size: 15 })} Nowa playlista</Btn>} />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">{store.myPlaylists.map((p) => <PlaylistCard key={p.id} playlist={p} onClick={() => store.setView({ name: "playlist", id: p.id })} />)}</div>
      ))}

      {tab === "liked" && (liked.length === 0 ? (
        <Empty icon={I.heart({ size: 34 })} title="Nic jeszcze polubionego" sub="Kliknij serce przy utworze, a pojawi się tutaj – na każdym Twoim urządzeniu." />
      ) : (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--line)]">
            <div><div className="font-display font-bold">Polubione utwory</div><div className="text-xs text-[var(--muted)]">{liked.length} utworów • {fmtLong(likedDur)}</div></div>
            <PlayAllBtn tracks={liked} label="Polubione" />
          </div>
          <div className="p-1.5">{liked.map((t, i) => <TrackRow key={t.id} track={t} index={i} context={liked} label="Polubione" />)}</div>
        </div>
      ))}

      {tab === "added" && (added.length === 0 ? (
        <Empty icon={I.upload({ size: 34 })} title="Nie dodałeś jeszcze własnych plików" sub="Wskaż pliki MP3, WAV lub OGG ze swojego komputera." action={<UploadButton small />} />
      ) : (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--line)] text-xs text-[var(--muted)]">Twoje pliki: {added.length} • łącznie {fmtLong(added.reduce((s, t) => s + t.duration, 0))}</div>
          <div className="p-1.5">{added.map((t, i) => <TrackRow key={t.id} track={t} index={i} context={added} label="Moje pliki" showAlbum />)}</div>
        </div>
      ))}
    </div>
  );
}

export function PlayAllBtn({ tracks, label }: { tracks: Track[]; label: string; shuffle?: boolean }) {
  const player = usePlayer();
  const [shuffled, setShuffled] = useState(false);
  if (!tracks.length) return null;
  return (
    <div className="flex items-center gap-2">
      <Btn kind="primary" onClick={() => player.play(shuffled ? [...tracks].sort(() => Math.random() - 0.5) : tracks, 0, label)}>{I.play({ size: 15 })} Odtwórz</Btn>
      <IconBtn title={shuffled ? "Wyłącz losowanie" : "Losuj"} active={shuffled} onClick={() => setShuffled((s) => !s)}>{I.shuffle({ size: 16 })}</IconBtn>
    </div>
  );
}

/* ================= PLAYLISTA ================= */

export function PlaylistView({ id }: { id: string }) {
  const store = useStore();
  const local = store.findPlaylist(id);
  const [fetched, setFetched] = useState<Playlist | null>(null);
  const [missing, setMissing] = useState(false);
  const [order, setOrder] = useState<Track[] | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const player = usePlayer();

  useEffect(() => {
    setFetched(null); setMissing(false); setOrder(null);
    if (!local) {
      api<{ playlist?: Playlist }>(`/api/playlists/${id}`).then((j) => j.playlist ? setFetched(j.playlist) : setMissing(true)).catch(() => setMissing(true));
    }
  }, [id, local]);

  const pl = local ?? fetched;
  const tracks = order ?? pl?.tracks ?? [];
  if (missing) return <Empty title="Playlista niedostępna" sub="Być może została usunięta albo jest prywatna." action={<Btn onClick={() => store.setView({ name: "home" })}>Wróć na start</Btn>} />;
  if (!pl) return <div className="py-20 text-center text-[var(--muted)]">Wczytywanie playlisty…</div>;
  const isOwner = pl.isOwner;

  const doReorder = () => {
    if (dragIdx === null || overIdx === null || dragIdx === overIdx || !order) return;
    const next = [...order];
    const [m] = next.splice(dragIdx, 1);
    next.splice(overIdx, 0, m);
    setOrder(next);
    void store.reorderPlaylist(pl.id, next.map((t) => t.id));
  };

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-[var(--line2)] bg-[var(--panel)] p-5 md:p-7">
        <SketchField />
        <div className="relative flex flex-col sm:flex-row gap-6 items-start">
          <div className="w-40 h-40 md:w-48 md:h-48 rounded-2xl overflow-hidden border-2 border-[var(--line2)] shrink-0"><Cover src={pl.cover} alt={pl.name} className="w-full h-full" iconSize={54} /></div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--muted)]">Playlista</div>
            <h1 className="font-display font-extrabold text-3xl md:text-4xl mt-1 truncate">{pl.name}</h1>
            {pl.description && <p className="text-sm text-[var(--muted)] mt-2 max-w-xl">{pl.description}</p>}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-sm text-[var(--muted)]">
              <span className="flex items-center gap-1.5">{I.user({ size: 14 })} {pl.ownerName}</span>
              <span>{tracks.length} utworów</span><span>{fmtLong(pl.totalDuration)}</span>
              {store.settings.social && <span className="flex items-center gap-1">{I.heart({ size: 13, filled: pl.liked, className: pl.liked ? "text-[var(--accent)]" : "" })} {pl.likes}</span>}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-5">
              <PlayAllBtn tracks={tracks} label={pl.name} />
              {tracks.length > 0 && <Btn kind="soft" onClick={() => player.play([...tracks].sort(() => Math.random() - 0.5), 0, pl.name)}>{I.shuffle({ size: 15 })} Losuj</Btn>}
              {store.settings.social && <IconBtn title={pl.liked ? "Wypolub playlistę" : "Polub playlistę"} onClick={() => store.togglePlaylistLike(pl.id)}><span className={pl.liked ? "text-[var(--accent)]" : ""}>{I.heart({ size: 19, filled: pl.liked })}</span></IconBtn>}
              <IconBtn title="Udostępnij" onClick={() => store.openModal({ type: "share", kind: "playlist", id: pl.id, name: pl.name })}>{I.share({ size: 18 })}</IconBtn>
              {isOwner && <><Btn kind="ghost" onClick={() => store.openModal({ type: "playlist-edit", id: pl.id })}>{I.edit({ size: 14 })} Edytuj</Btn><Btn kind="soft" onClick={() => store.openModal({ type: "playlist-add", playlistId: pl.id })}>{I.plus({ size: 14 })} Dodaj utwory</Btn></>}
            </div>
          </div>
        </div>
      </div>

      {tracks.length === 0 ? (
        <Empty icon={I.music({ size: 32 })} title="Ta playlista jest pusta" sub={isOwner ? "Dodaj utwory z biblioteki i ułóż własną kolejność." : "Właściciel nie dodał jeszcze utworów."} action={isOwner ? <Btn kind="primary" onClick={() => store.openModal({ type: "playlist-add", playlistId: pl.id })}>{I.plus({ size: 15 })} Dodaj utwory</Btn> : undefined} />
      ) : (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] overflow-hidden">
          {isOwner && tracks.length > 1 && <div className="px-4 py-2 text-[11px] text-[var(--muted2)] border-b border-[var(--line)] flex items-center gap-1.5">{I.grip({ size: 12 })} Przeciągnij wiersze, aby zmienić kolejność – zmiana zapisuje się automatycznie.</div>}
          <div className="p-1.5">
            {tracks.map((t, i) => (
              <TrackRow key={`${t.id}-${i}`} track={t} index={i} context={tracks} label={pl.name} showAlbum draggable={isOwner} dragActive={overIdx === i && dragIdx !== null && dragIdx !== i}
                onDragStart={() => { setOrder(tracks); setDragIdx(i); }}
                onDragOver={(e) => { e.preventDefault(); if (overIdx !== i) setOverIdx(i); }}
                onDrop={() => { doReorder(); setDragIdx(null); setOverIdx(null); }}
                onRemove={isOwner ? () => { const next = tracks.filter((_, idx) => idx !== i); setOrder(next); void store.removeFromPlaylist(pl.id, t.id); } : undefined}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
