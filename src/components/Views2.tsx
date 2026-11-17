"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { api, usePlayer, useStore } from "./ctx";
import type { AppSettings, GroupDetail, LyricsDoc, Track, UserLite } from "@/lib/types";
import { ACCENTS, fmtLong, fmtTime, timeAgo } from "@/lib/types";
import type { BadgeDefinition, ProfileBadge } from "@/lib/types";
import {
  Avatar, BadgeChip, BadgeDots, Btn, Cover, Empty, Field, I, IconBtn, KoczMark,
  inputCls, PlaylistCard, SectionHead, SketchField, TrackRow, Toggle,
} from "./ui";
import { PlayAllBtn } from "./Views1";


/* ================= STATYSTYKI ================= */

export function StatsView() {
  const store = useStore();
  const s = store.stats;
  const [range, setRange] = useState<7 | 30>(7);

  useEffect(() => {
    if (store.user && !s) void store.refreshStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.user]);

  if (!store.user) {
    return (
      <Empty
        icon={I.chart({ size: 36 })}
        title="Statystyki czekają na konto"
        sub="Zaloguj się, aby śledzić czas słuchania, ulubione utwory i swoją aktywność."
        action={<Btn kind="primary" onClick={() => store.openModal({ type: "auth" })}>Zaloguj się</Btn>}
      />
    );
  }

  const daily = s ? s.daily.slice(-range) : [];
  const maxDay = Math.max(1, ...daily.map((d) => d.seconds));
  const maxTrack = Math.max(1, ...(s?.topTracks.map((t) => t.seconds) ?? [1]));
  const maxArtist = Math.max(1, ...(s?.topArtists.map((a) => a.seconds) ?? [1]));

  return (
    <div className="space-y-8">
      <SectionHead
        title="Statystyki"
        sub="Twoja historia słuchania – liczymy każdą sekundę"
        action={
          <Btn kind="soft" onClick={() => void store.refreshStats()}>
            Odśwież
          </Btn>
        }
      />

      {!s ? (
        <div className="py-20 text-center text-[var(--muted)]">Liczenie statystyk…</div>
      ) : (
        <>
          {/* Karty */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Łączny czas słuchania", value: fmtLong(s.totalSeconds), icon: I.clock({ size: 18 }) },
              { label: "Rozpoczętych odsłuchów", value: String(s.totalPlays), icon: I.play({ size: 18 }) },
              { label: "Unikalnych utworów", value: String(s.uniqueTracks), icon: I.music({ size: 18 }) },
              { label: "Aktywne dni", value: String(s.activeDays), icon: I.edit({ size: 18 }) },
            ].map((c) => (
              <div key={c.label} className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
                <div className="flex items-center gap-2 text-[var(--accent)]">{c.icon}<span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">{c.label}</span></div>
                <div className="font-display font-extrabold text-2xl md:text-3xl mt-2">{c.value}</div>
              </div>
            ))}
          </div>

          {/* Wykres */}
          <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-lg">Aktywność słuchania</h3>
              <div className="flex gap-1 p-1 bg-[var(--bg2)] rounded-lg">
                {([7, 30] as const).map((r) => (
                  <button key={r} type="button" onClick={() => setRange(r)}
                    className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${range === r ? "bg-[var(--panel2)] text-[var(--accent2)]" : "text-[var(--muted)]"}`}>
                    {r === 7 ? "Tydzień" : "Miesiąc"}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-end gap-[3px] h-36">
              {daily.map((d) => {
                const h = Math.round((d.seconds / maxDay) * 100);
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5 group" title={`${d.date} • ${fmtLong(d.seconds)}`}>
                    <div className="w-full flex-1 flex items-end">
                      <div
                        className="w-full rounded-t-md transition-all duration-500 group-hover:brightness-125"
                        style={{
                          height: `${Math.max(2, h)}%`,
                          background: d.seconds > 0 ? "linear-gradient(to top, var(--accent), var(--accent2))" : "#e7e7e4",
                        }}
                      />
                    </div>
                    {range === 7 && <span className="text-[9px] text-[var(--muted2)]">{new Date(d.date).getDay()}</span>}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-1.5 text-[10px] text-[var(--muted2)]">
              <span>{daily[0]?.date}</span>
              <span>dziś</span>
            </div>
          </section>

          <div className="grid lg:grid-cols-2 gap-5">
            {/* Top utwory */}
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5">
              <h3 className="font-display font-bold text-lg mb-4">Najczęściej odtwarzane</h3>
              {s.topTracks.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">Odtwórz pierwsze utwory, a pojawią się tu.</p>
              ) : (
                <div className="space-y-3">
                  {s.topTracks.map((t, i) => (
                    <div key={t.track.id} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-[var(--muted2)] w-4">{i + 1}</span>
                      <div className="w-10 h-10 rounded-md overflow-hidden bg-[var(--panel2)] shrink-0">
                        <Cover src={t.track.cover} alt="" className="w-full h-full" iconSize={15} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold truncate">{t.track.title}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="h-1 flex-1 rounded-full bg-[var(--bg2)] overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${(t.seconds / maxTrack) * 100}%`, background: "linear-gradient(to right, var(--accent), var(--accent2))" }} />
                          </div>
                          <span className="text-[10px] text-[var(--muted2)] whitespace-nowrap">{fmtLong(t.seconds)} • {t.plays}×</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Wykonawcy */}
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5">
              <h3 className="font-display font-bold text-lg mb-4">Najczęściej słuchani wykonawcy</h3>
              {s.topArtists.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">Brak danych – czas na pierwszy kocz.</p>
              ) : (
                <div className="space-y-3">
                  {s.topArtists.map((a, i) => (
                    <div key={a.artist} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-[var(--muted2)] w-4">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold truncate">{a.artist}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="h-1 flex-1 rounded-full bg-[var(--bg2)] overflow-hidden">
                            <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${(a.seconds / maxArtist) * 100}%` }} />
                          </div>
                          <span className="text-[10px] text-[var(--muted2)] whitespace-nowrap">{fmtLong(a.seconds)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Playsty + aktywność */}
          <div className="grid lg:grid-cols-2 gap-5">
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5">
              <h3 className="font-display font-bold text-lg mb-4">Twoje najpopularniejsze playlisty</h3>
              {s.topPlaylists.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">Utwórz playlistę, aby zobaczyć ją tu.</p>
              ) : (
                <div className="space-y-2.5">
                  {s.topPlaylists.map(({ playlist: p }) => (
                    <button key={p.id} type="button" onClick={() => store.setView({ name: "playlist", id: p.id })}
                      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--hover)] transition-colors cursor-pointer text-left">
                      <div className="w-11 h-11 rounded-md overflow-hidden bg-[var(--panel2)] shrink-0">
                        <Cover src={p.cover} alt="" className="w-full h-full" iconSize={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold truncate flex items-center gap-1.5">
                          {p.name}
                        </div>
                        <div className="text-xs text-[var(--muted)]">{p.tracks.length} utworów</div>
                      </div>
                      <span className="flex items-center gap-1 text-xs text-[var(--muted)]">{I.heart({ size: 12, filled: true, className: "text-[var(--accent)]" })} {p.likes}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5">
              <h3 className="font-display font-bold text-lg mb-4">Historia aktywności</h3>
              {s.activity.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">Jeszcze cicho. Włącz muzykę.</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {s.activity.map((a, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <div className="w-9 h-9 rounded-md overflow-hidden bg-[var(--panel2)] shrink-0">
                        <Cover src={a.track.cover} alt="" className="w-full h-full" iconSize={13} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="font-medium truncate block">{a.track.title}</span>
                        <span className="text-[11px] text-[var(--muted2)]">{a.track.artist}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs text-[var(--muted)]">{timeAgo(a.at)}</div>
                        <div className="text-[10px] text-[var(--muted2)]">{fmtTime(a.seconds)} odsłuchu</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

/* ================= TEKSTY ================= */

export function LyricsView() {
  const store = useStore();
  const player = usePlayer();
  const withLyrics = useMemo(() => store.tracks.filter((t) => t.hasLyrics), [store.tracks]);
  const [selId, setSelId] = useState<string | null>(null);
  const [doc, setDoc] = useState<LyricsDoc | null>(null);
  const [loading, setLoading] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const selIdEff = player.current?.hasLyrics ? player.current.id : (selId ?? withLyrics[0]?.id ?? null);

  useEffect(() => {
    if (!selIdEff) return;
    let alive = true;
    setLoading(true);
    api<{ lyrics: LyricsDoc | null }>(`/api/lyrics?trackId=${selIdEff}`)
      .then((r) => alive && setDoc(r.lyrics))
      .catch(() => alive && setDoc(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [selIdEff]);

  const isCurrentTrack = player.current?.id === selIdEff;
  const pos = player.position;
  const activeIdx = useMemo(() => {
    if (!doc?.synced || !isCurrentTrack || !player.playing) return -1;
    let idx = -1;
    for (let i = 0; i < doc.lines.length; i++) {
      const t = doc.lines[i].t;
      if (t !== undefined && t <= pos) idx = i;
    }
    return idx;
  }, [doc, isCurrentTrack, player.playing, pos]);

  useEffect(() => {
    if (activeIdx >= 0 && scrollRef.current) {
      const el = scrollRef.current.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeIdx]);

  const track = store.findTrack(selIdEff ?? "");

  return (
    <div className="space-y-6">
      <SectionHead
        title="Teksty"
        sub="Tekst aktualnie odtwarzanej piosenki + wszystkie zapisane teksty"
        action={
          <div className="flex gap-2">
            {track && (
              <Btn kind="soft" onClick={() => store.openModal({ type: "lyrics-edit", trackId: track.id })}>
                {I.edit({ size: 14 })} {track.hasLyrics ? "Edytuj tekst" : "Dodaj tekst"}
              </Btn>
            )}
            {doc && (
              <Btn kind="ghost" onClick={() => setFullscreen(true)}>
                {I.expand({ size: 15 })} Tryb pełnoekranowy
              </Btn>
            )}
          </div>
        }
      />

      <div className="grid lg:grid-cols-[320px_1fr] gap-5 items-start">
        {/* Lista utworów z tekstami */}
        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-2 max-h-[70vh] overflow-y-auto">
          {withLyrics.length === 0 ? (
            <p className="text-sm text-[var(--muted)] p-4 text-center">
              Brak tekstów. Dodaj pierwszy – z menu utworu wybierz „Tekst utworu”.
            </p>
          ) : (
            withLyrics.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelId(t.id)}
                className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors cursor-pointer ${
                  selIdEff === t.id ? "bg-[var(--accent)]/12 ring-1 ring-[var(--accent)]/40" : "hover:bg-[var(--hover)]"
                }`}
              >
                <div className="w-10 h-10 rounded-md overflow-hidden bg-[var(--panel2)] shrink-0">
                  <Cover src={t.cover} alt="" className="w-full h-full" iconSize={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate">{t.title}</div>
                  <div className="text-xs text-[var(--muted)] truncate">{t.artist}</div>
                </div>
                {player.current?.id === t.id && (player.playing ? I.music({ size: 14, className: "text-[var(--accent)]" }) : I.play({ size: 12, className: "text-[var(--muted)]" }))}
              </button>
            ))
          )}
        </div>

        {/* Panel tekstu */}
        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] overflow-hidden">
          {track && (
            <div className="flex items-center gap-4 px-5 py-4 border-b border-[var(--line)] bg-[var(--bg2)]/60">
              <div className="w-12 h-12 rounded-lg overflow-hidden border border-[var(--line2)] shrink-0">
                <Cover src={track.cover} alt="" className="w-full h-full" iconSize={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-display font-bold truncate">{track.title}</div>
                <div className="text-xs text-[var(--muted)]">{track.artist}</div>
              </div>
              {doc?.synced ? (
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent2)] border border-[var(--accent)]/30 rounded-full px-2.5 py-1">
                  zsynchronizowany
                </span>
              ) : doc ? (
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted2)] border border-[var(--line2)] rounded-full px-2.5 py-1">
                  bez znaczników
                </span>
              ) : null}
            </div>
          )}
          <div ref={scrollRef} className="p-6 md:p-8 max-h-[58vh] overflow-y-auto">
            {loading ? (
              <p className="text-sm text-[var(--muted)] text-center py-10">Wyciągam kartkę z kieszeni…</p>
            ) : !doc ? (
              <Empty
                icon={I.book({ size: 30 })}
                title="Brak tekstu"
                sub="Ten utwór nie ma jeszcze tekstu. Dodaj go (własne utwory, domena publiczna lub CC)."
                action={track ? <Btn kind="primary" onClick={() => store.openModal({ type: "lyrics-edit", trackId: track.id })}>Dodaj tekst</Btn> : undefined}
              />
            ) : (
              <div className="space-y-2.5">
                {doc.lines.map((l, i) => {
                  const active = i === activeIdx;
                  const future = activeIdx >= 0 && (l.t ?? Infinity) > pos;
                  return (
                    <div key={i} data-idx={i} className={`flex gap-4 items-baseline transition-all duration-500 ${active ? "scale-[1.02]" : ""} ${!active && future ? "opacity-35" : !active ? "opacity-70" : ""}`}>
                      {l.t !== undefined && (
                        <span className={`text-[11px] tabular-nums shrink-0 w-10 text-right ${active ? "text-[var(--accent)]" : "text-[var(--muted2)]"}`}>
                          {fmtTime(l.t)}
                        </span>
                      )}
                      <span
                        className={`font-display text-lg md:text-xl leading-relaxed transition-colors duration-500 ${active ? "font-bold" : "font-medium"}`}
                        style={active ? { color: "var(--accent2)", textShadow: "0 0 24px color-mix(in srgb, var(--accent) 45%, transparent)" } : undefined}
                      >
                        {l.x}
                      </span>
                    </div>
                  );
                })}
                <p className="text-[11px] text-[var(--muted2)] pt-4">
                  {doc.authorName ? `Dodane przez ${doc.authorName}. ` : ""}
                  {doc.synced && isCurrentTrack ? "Śledzę aktualną linijkę – odtwarzaj i śpiewaj." : "Przewijaj tekst ręcznie."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TRYB PEŁNOEKRANOWY */}
      {fullscreen && doc && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-[var(--bg)]" style={{ animation: "coc-fade 0.4s ease both" }}>
          <SketchField />
          <div className="relative flex items-center justify-between px-6 md:px-10 py-5 border-b border-[var(--line)]">
            <div className="flex items-center gap-3 min-w-0">
              <KoczMark className="w-12 h-9 object-contain rounded-sm" alt="" />
              <div className="min-w-0">
                <div className="font-display font-bold truncate">{track?.title}</div>
                <div className="text-xs text-[var(--muted)] truncate">{track?.artist}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {track && (
                <IconBtn title={player.playing ? "Pauza" : "Odtwórz"} onClick={player.toggle}>
                  {player.playing ? I.pause({ size: 20 }) : I.play({ size: 20 })}
                </IconBtn>
              )}
              <IconBtn title="Zamknij" onClick={() => setFullscreen(false)}>
                {I.x({ size: 20 })}
              </IconBtn>
            </div>
          </div>
          <div className="relative flex-1 overflow-y-auto px-6 md:px-16 py-10">
            <div className="max-w-3xl mx-auto space-y-4">
              {doc.lines.map((l, i) => {
                const active = i === activeIdx;
                const future = activeIdx >= 0 && (l.t ?? Infinity) > pos;
                return (
                  <p
                    key={i}
                    data-idx={i}
                    className={`koc-lyric-line font-display text-center ${active ? "text-3xl md:text-4xl font-extrabold" : future ? "text-xl md:text-2xl opacity-30" : "text-xl md:text-2xl opacity-60"}`}
                    style={active ? { color: "var(--accent2)", textShadow: "0 0 40px color-mix(in srgb, var(--accent) 55%, transparent)" } : undefined}
                  >
                    {l.x}
                  </p>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= GRUPY ================= */

export function GroupsView() {
  const store = useStore();
  if (!store.settings.social) {
    return (
      <Empty
        icon={I.users({ size: 36 })}
        title="Funkcje społecznościowe wyłączone"
        sub="Włącz je w Ustawieniach, aby dołączać do grup i dzielić się muzyką."
        action={<Btn onClick={() => store.setView({ name: "settings" })}>Otwórz ustawienia</Btn>}
      />
    );
  }
  const mine = store.groups.filter((g) => g.isMember);
  const other = store.groups.filter((g) => !g.isMember);

  return (
    <div className="space-y-8">
      <SectionHead
        title="Grupy muzyczne"
        sub="Małe kręgi koczowników – wspólne playlisty i krótkie posty"
        action={
          <Btn kind="primary" onClick={() => store.openModal(store.user ? { type: "group-create" } : { type: "auth" })}>
            {I.plus({ size: 15 })} Nowa grupa
          </Btn>
        }
      />
      <section>
        <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--muted2)] mb-3">Moje kręgi ({mine.length})</h3>
        {mine.length === 0 ? (
          <Empty icon={I.users({ size: 28 })} title="Jeszcze nie koczujesz w grupie" sub="Dołącz do istniejącej poniżej albo załóż własny krąg." />
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mine.map((g) => (
              <GroupCard key={g.id} id={g.id} name={g.name} desc={g.description} members={g.memberCount} posts={g.postCount} member ownerName={g.ownerName} onOpen={() => store.setView({ name: "group", id: g.id })} />
            ))}
          </div>
        )}
      </section>
      {other.length > 0 && (
        <section>
          <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--muted2)] mb-3">Inne grupy ({other.length})</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {other.map((g) => (
              <GroupCard key={g.id} id={g.id} name={g.name} desc={g.description} members={g.memberCount} posts={g.postCount} ownerName={g.ownerName} onOpen={() => store.setView({ name: "group", id: g.id })} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function GroupCard({
  id, name, desc, members, posts, member, ownerName, onOpen,
}: {
  id: string; name: string; desc: string; members: number; posts: number;
  member?: boolean; ownerName: string; onOpen: () => void;
}) {
  const store = useStore();
  void id;
  return (
    <div className="koc-card rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 flex flex-col">
      <button type="button" onClick={onOpen} className="text-left cursor-pointer">
        <div className="font-display font-bold text-lg">{name}</div>
        <p className="text-sm text-[var(--muted)] mt-1 line-clamp-2 flex-1">{desc || "Grupa koczowiska"}</p>
      </button>
      <div className="flex items-center gap-3 mt-4 text-[11px] text-[var(--muted2)]">
        <span className="flex items-center gap-1">{I.users({ size: 12 })} {members} osób</span>
        <span className="flex items-center gap-1">{I.music({ size: 12 })} {posts} postów</span>
        <span className="flex items-center gap-1">{I.user({ size: 12 })} {ownerName}</span>
      </div>
      <div className="mt-4">
        {member ? (
          <Btn kind="soft" className="w-full" onClick={onOpen}>Wejdź do kręgu</Btn>
        ) : store.user ? (
          <Btn kind="ghost" className="w-full" onClick={() => void store.joinLeaveGroup(id, "join")}>Dołącz do grupy</Btn>
        ) : (
          <Btn kind="ghost" className="w-full" onClick={() => store.openModal({ type: "auth" })}>Zaloguj, aby dołączyć</Btn>
        )}
      </div>
    </div>
  );
}

export function GroupDetailView({ id }: { id: string }) {
  const store = useStore();
  const [g, setG] = useState<GroupDetail | null>(null);
  const [missing, setMissing] = useState(false);
  const [post, setPost] = useState("");
  const [selPl, setSelPl] = useState("");
  const player = usePlayer();

  const load = () => {
    setMissing(false);
    api<{ group: GroupDetail }>(`/api/groups/${id}`)
      .then((r) => setG(r.group))
      .catch(() => setMissing(true));
  };
  useEffect(load, [id, store.user?.id]);

  if (missing || (!g && store.loading)) {
    return store.loading ? <div className="py-20 text-center text-[var(--muted)]">Wczytywanie…</div> : <Empty title="Grupa niedostępna" action={<Btn onClick={() => store.setView({ name: "groups" })}>Wróć do grup</Btn>} />;
  }
  if (!g) return null;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[var(--line2)] bg-[var(--panel)] p-6">
        <button type="button" className="flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--text)] transition-colors cursor-pointer mb-3" onClick={() => store.setView({ name: "groups" })}>
          {I.back({ size: 15 })} Wszystkie grupy
        </button>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display font-extrabold text-3xl flex items-center gap-3">
              {g.name}
              {g.isMember && <span className="text-[10px] font-bold uppercase tracking-wider rounded-full px-2.5 py-1" style={{ background: "color-mix(in srgb, var(--accent) 15%, transparent)", color: "var(--accent2)" }}>w kręgu</span>}
            </h1>
            {g.description && <p className="text-sm text-[var(--muted)] mt-2 max-w-xl">{g.description}</p>}
            <div className="flex items-center gap-4 mt-3 text-xs text-[var(--muted2)]">
              <span>{g.memberCount} członków</span>
              <span>{g.postCount} postów</span>
              <span>założona przez {g.ownerName}</span>
            </div>
          </div>
          <div>
            {g.isMember ? (
              g.members.find((m) => m.user.id === store.user?.id)?.role === "owner" ? (
                <Btn kind="danger" onClick={async () => {
                  if (confirm("Zamknąć całą grupę? Zniknie dla wszystkich.")) {
                    await store.joinLeaveGroup(g.id, "leave");
                    store.setView({ name: "groups" });
                  }
                }}>
                  {I.trash({ size: 14 })} Zamknij grupę
                </Btn>
              ) : (
                <Btn kind="ghost" onClick={async () => {
                  await store.joinLeaveGroup(g.id, "leave");
                  load();
                }}>Opuść grupę</Btn>
              )
            ) : (
              <Btn kind="primary" onClick={async () => {
                if (!store.user) {
                  store.openModal({ type: "auth" });
                  return;
                }
                await store.joinLeaveGroup(g.id, "join");
                load();
              }}>
                {I.plus({ size: 15 })} Dołącz do kręgu
              </Btn>
            )}
          </div>
        </div>
        {/* Członkowie */}
        <div className="flex flex-wrap items-center gap-2 mt-5">
          {g.members.map((m) => (
            <button key={m.user.id} type="button" onClick={() => store.setView({ name: "profile", username: m.user.username })}
              className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-[var(--bg2)] border border-[var(--line)] hover:border-[var(--accent)] transition-colors cursor-pointer" title={m.user.username}>
              <Avatar user={m.user} size={26} />
              <span className="text-xs font-medium">{m.user.displayName}</span>
              <BadgeDots badges={m.user.badges} max={3} />
              {m.role === "owner" && I.gear({ size: 11, className: "text-[var(--accent2)]" })}
            </button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5 items-start">
        {/* Posty */}
        <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5">
          <h3 className="font-display font-bold text-lg mb-4">Posty grupowe</h3>
          {!store.user && (
            <div className="rounded-xl border border-[var(--line)] bg-[var(--bg2)] p-3.5 mb-4 flex items-center justify-between gap-3">
              <span className="text-xs text-[var(--muted)]">Zaloguj się i dołącz do grupy, aby pisać posty.</span>
              <Btn kind="soft" onClick={() => store.openModal({ type: "auth" })}>Zaloguj się</Btn>
            </div>
          )}
          {g.isMember && store.user && (
            <div className="flex gap-2 mb-4">
              <Avatar user={store.user} size={32} />
              <div className="flex-1">
                <textarea
                  className={inputCls}
                  rows={2}
                  placeholder="Napisz coś krótko – max 500 znaków…"
                  value={post}
                  onChange={(e) => setPost(e.target.value.slice(0, 500))}
                />
                <div className="flex justify-end mt-2">
                  <Btn kind="primary" disabled={!post.trim()} onClick={async () => {
                    const body = post.trim();
                    setPost("");
                    await store.addGroupPost(g.id, body);
                    load();
                  }}>
                    Opublikuj
                  </Btn>
                </div>
              </div>
            </div>
          )}
          <div className="space-y-3 max-h-[46vh] overflow-y-auto pr-1">
            {g.posts.length === 0 && <p className="text-sm text-[var(--muted)] text-center py-6">Cisza w kręgu. Porozmawiajmy.</p>}
            {g.posts.map((p) => (
              <div key={p.id} className="rounded-xl bg-[var(--bg2)] border border-[var(--line)] p-4">
                <div className="flex items-center gap-2.5">
                  <Avatar user={p.user} size={28} />
                  <button type="button" className="text-sm font-semibold hover:underline cursor-pointer" onClick={() => store.setView({ name: "profile", username: p.user.username })}>
                    {p.user.displayName}
                  </button>
                  <BadgeDots badges={p.user.badges} max={3} />
                  <span className="text-[11px] text-[var(--muted2)] ml-auto">{timeAgo(p.createdAt)}</span>
                </div>
                <p className="text-sm mt-2 leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Wspólne playlisty */}
        <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5">
          <h3 className="font-display font-bold text-lg mb-4">Wspólne playlisty</h3>
          {g.isMember && store.myPlaylists.length > 0 && (
            <div className="flex gap-2 mb-4">
              <select className={inputCls} value={selPl} onChange={(e) => setSelPl(e.target.value)}>
                <option value="">Wybierz swoją playlistę…</option>
                {store.myPlaylists.map((p) => (
                  <option key={p.id} value={p.id} disabled={p.isPrivate || g.playlists.some((x) => x.id === p.id)}>
                    {p.name} {p.isPrivate ? "(prywatna — zmień widoczność)" : g.playlists.some((x) => x.id === p.id) ? "(już w grupie)" : ""}
                  </option>
                ))}
              </select>
              <Btn kind="soft" disabled={!selPl} onClick={async () => {
                await store.addGroupPlaylist(g.id, selPl);
                setSelPl("");
                load();
              }}>
                {I.share({ size: 14 })} Udostępnij
              </Btn>
            </div>
          )}
          <div className="space-y-2">
            {g.playlists.length === 0 && <p className="text-sm text-[var(--muted)] text-center py-6">Brak wspólnych playlist. Członkowie mogą udostępniać swoje.</p>}
            {g.playlists.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--bg2)] p-3">
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-[var(--panel2)] shrink-0">
                  <Cover src={p.cover} alt="" className="w-full h-full" iconSize={17} />
                </div>
                <div className="min-w-0 flex-1">
                  <button type="button" className="text-sm font-semibold truncate block hover:text-[var(--accent2)] transition-colors cursor-pointer" onClick={() => store.setView({ name: "playlist", id: p.id })}>
                    {p.name}
                  </button>
                  <div className="text-xs text-[var(--muted)]">{p.ownerName} • {p.tracks.length} utworów</div>
                </div>
                {p.tracks.length > 0 && (
                  <Btn kind="soft" onClick={() => player.play(p.tracks, 0, p.name)}>
                    {I.play({ size: 14 })}
                  </Btn>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

/* ================= PROFIL ================= */

interface ProfileData {
  profile: {
    user: UserLite & { username: string; createdAt: string };
    followers: number;
    following: number;
    followedByMe: boolean;
    playlistCount: number;
    trackCount: number;
  };
  playlists: PlaylistCardData[];
  tracks: Track[];
  badges: ProfileBadge[];
  profileStyle?: { theme: string; accent: string; showActivity: boolean; banner?: string };
  nowPlaying?: { id: string; title: string; artist: string; cover: string | null; updatedAt: string } | null;
}
type PlaylistCardData = Parameters<typeof PlaylistCard>[0]["playlist"];

export function ProfileView({ username }: { username: string }) {
  const store = useStore();
  const [data, setData] = useState<ProfileData | null>(null);
  const [missing, setMissing] = useState(false);

  const load = () => {
    setMissing(false);
    api<ProfileData>(`/api/users/${encodeURIComponent(username)}`)
      .then(setData)
      .catch(() => setMissing(true));
  };
  useEffect(load, [username, store.user?.id, store.user?.displayName, store.user?.bio, store.user?.avatar]);
  useEffect(() => {
    const timer = setInterval(() => {
      api<ProfileData>(`/api/users/${encodeURIComponent(username)}`).then(setData).catch(() => {});
    }, 30_000);
    return () => clearInterval(timer);
  }, [username]);

  const isMe = store.user?.username === username;
  const social = store.settings.social;

  if (missing) return <Empty title="Nie znaleziono profilu" sub={`Użytkownik @${username} nie istnieje.`} action={<Btn onClick={() => store.setView({ name: "home" })}>Wróć na start</Btn>} />;
  if (!data) return <div className="py-20 text-center text-[var(--muted)]">Wczytywanie profilu…</div>;

  const u = data.profile.user;

  return (
    <div className="space-y-8">
      <div className={`relative overflow-hidden rounded-2xl border p-6 md:p-8 ${data.profileStyle?.theme === "night" ? "text-white" : ""}`} style={{ backgroundColor: ({ paper: "#ffffff", night: "#292d34", forest: "#e4eee6", sunset: "#f2e5dc" } as Record<string, string>)[data.profileStyle?.theme ?? "paper"] ?? "#ffffff", borderColor: ({ graphite: "#535962", red: "#a33b3b", blue: "#356b9a", green: "#397653", violet: "#76549a" } as Record<string, string>)[data.profileStyle?.accent ?? "graphite"] ?? "#535962", backgroundImage: data.profileStyle?.banner ? `linear-gradient(90deg, rgba(20,20,24,.74), rgba(20,20,24,.25)), url("${data.profileStyle.banner}")` : undefined, backgroundSize: "cover", backgroundPosition: "center" }}>
        <SketchField />
        <div className="relative flex flex-col sm:flex-row gap-6 items-start">
          <Avatar user={u} size={96} className="ring-2 ring-[var(--line2)]" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display font-extrabold text-3xl">{u.displayName}</h1>
              {data.badges.length > 0 && <span className="flex flex-wrap gap-1.5">{data.badges.map((badge) => <BadgeChip key={badge.badge} badge={badge} large />)}</span>}
              {u.isSystem && <span className="text-[10px] font-bold uppercase tracking-wider rounded-full px-2.5 py-1 border border-[var(--accent)]/40 text-[var(--accent2)]">profil oficjalny</span>}
            </div>
            <div className="text-sm text-[var(--muted)] mt-0.5">@{u.username} • koczowisko od {new Date(u.createdAt).getFullYear()}</div>
            {u.bio && <p className="text-sm text-[var(--muted)] mt-3 max-w-xl leading-relaxed">{u.bio}</p>}
            <div className="flex flex-wrap gap-x-5 gap-y-1 mt-4 text-sm">
              <span><b className="font-display">{data.profile.followers}</b> <span className="text-[var(--muted)]">obserwujących</span></span>
              <span><b className="font-display">{data.profile.following}</b> <span className="text-[var(--muted)]">obserwowanych</span></span>
              <span><b className="font-display">{data.profile.playlistCount}</b> <span className="text-[var(--muted)]">playlist</span></span>
              <span><b className="font-display">{data.profile.trackCount}</b> <span className="text-[var(--muted)]">dodanych utworów</span></span>
            </div>
            <div className="flex flex-wrap gap-2 mt-5">
              {isMe ? (
                <Btn kind="primary" onClick={() => store.openModal({ type: "profile-edit" })}>
                  {I.edit({ size: 14 })} Edytuj profil
                </Btn>
              ) : social && store.user ? (
                <>
                  <Btn
                    kind={data.profile.followedByMe ? "ghost" : "primary"}
                    onClick={async () => {
                      await store.follow(u.id, !data.profile.followedByMe);
                      load();
                    }}
                  >
                    {I.user({ size: 14 })} {data.profile.followedByMe ? "Obserwujesz" : "Obserwuj"}
                  </Btn>
                  <Btn kind="soft" onClick={async () => {
                    try {
                      await api("/api/friends", { method: "POST", body: JSON.stringify({ action: "send", userId: u.id }) });
                      store.toast("Zaproszenie do znajomych wysłane lub zaakceptowane.");
                    } catch (e) { store.toast((e as Error).message, "err"); }
                  }}>Dodaj do znajomych</Btn>
                </>
              ) : null}
              {!isMe && store.user && (
                <Btn kind="ghost" onClick={async () => {
                  const reason = window.prompt("Powód zgłoszenia profilu (5–500 znaków):");
                  if (!reason) return;
                  try {
                    await api("/api/reports", { method: "POST", body: JSON.stringify({ targetType: "user", targetId: u.id, reason }) });
                    store.toast("Zgłoszenie wysłane do administracji.");
                  } catch (e) { store.toast((e as Error).message, "err"); }
                }}>Zgłoś profil</Btn>
              )}
              {!isMe && (
                <Btn kind="soft" onClick={() => store.openModal({ type: "share", kind: "profile", id: u.username, name: u.displayName })}>
                  {I.share({ size: 14 })} Udostępnij profil
                </Btn>
              )}
              {isMe && <Btn kind="ghost" onClick={() => store.openModal({ type: "share", kind: "profile", id: u.username, name: u.displayName })}>{I.share({ size: 14 })} Udostępnij link</Btn>}
            </div>
          </div>
        </div>
      </div>

      {data.nowPlaying && (
        <section className="rounded-xl border border-[var(--accent)]/30 bg-[var(--panel)] p-4 flex items-center gap-3">
          <div className="relative shrink-0">
            <Cover src={data.nowPlaying.cover} alt="" className="w-14 h-14 rounded-lg overflow-hidden" iconSize={18} />
            <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[var(--panel)]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Słucha teraz</div>
            <div className="font-semibold truncate">{data.nowPlaying.title}</div>
            <div className="text-xs text-[var(--muted)] truncate">{data.nowPlaying.artist}</div>
          </div>
          <span className="text-xs text-[var(--muted2)]">na żywo</span>
        </section>
      )}

      <section>
        <SectionHead title="Publiczne playlisty" sub={`${data.playlists.length} w bibliotece`} />
        {data.playlists.length === 0 ? (
          <Empty icon={I.library({ size: 28 })} title="Brak publicznych playlist" />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {data.playlists.map((p) => (
              <PlaylistCard key={p.id} playlist={p} onClick={() => store.setView({ name: "playlist", id: p.id })} />
            ))}
          </div>
        )}
      </section>

      {data.profileStyle?.showActivity !== false && data.tracks.length > 0 && (
        <section>
          <SectionHead title="Dodane utwory" sub="Pliki wrzucone do biblioteki przez tego użytkownika" action={<PlayAllBtn tracks={data.tracks} label="Utwory użytkownika" />} />
          <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-1.5">
            {data.tracks.map((t, i) => (
              <TrackRow key={t.id} track={t} index={i} context={data.tracks} label="Utwory użytkownika" showAlbum />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ================= USTAWIENIA ================= */

const Row = ({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between gap-4 py-3.5 border-b border-[var(--line)] last:border-0">
      <div className="min-w-0">
        <div className="text-sm font-semibold">{title}</div>
        {sub && <div className="text-xs text-[var(--muted)] mt-0.5">{sub}</div>}
      </div>
      {children}
    </div>
  );

const Card = ({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) => (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5">
      <h3 className="font-display font-bold text-lg mb-3 flex items-center gap-2.5 text-[var(--accent)]">
        {icon} <span className="text-[var(--text)]">{title}</span>
      </h3>
      {children}
    </section>
  );



/* ================= ODZNAKI (ręczne nadawanie) ================= */

function BadgeAdminCard({ Card }: { Card: (p: { title: string; icon: React.ReactNode; children: React.ReactNode }) => React.ReactNode }) {
  const store = useStore();
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [catalog, setCatalog] = useState<BadgeDefinition[]>([]);
  const [target, setTarget] = useState(store.user?.username ?? "");
  const [selectedBadges, setSelectedBadges] = useState<ProfileBadge[]>(store.badges ?? []);
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setTarget(store.user?.username ?? "");
  }, [store.user?.id, store.user?.username]);

  useEffect(() => {
    if (!unlocked) return;
    let active = true;
    setSelectedLoading(true);
    setSelectedBadges([]);
    setError("");
    const timer = window.setTimeout(() => {
      const username = target.trim().replace(/^@/, "");
      const url = username ? `/api/badges?username=${encodeURIComponent(username)}` : "/api/badges";
      void api<{ badges?: ProfileBadge[]; mine?: ProfileBadge[] }>(url)
        .then((response) => { if (active) setSelectedBadges(response.badges ?? response.mine ?? []); })
        .catch((e) => { if (active) setError((e as Error).message); })
        .finally(() => { if (active) setSelectedLoading(false); });
    }, 300);
    return () => { active = false; window.clearTimeout(timer); };
  }, [target, unlocked]);

  const send = async (action: "unlock" | "add" | "remove", badge?: string) => {
    setError("");
    setBusy(action + (badge ?? ""));
    try {
      const response = await api<{ catalog: BadgeDefinition[]; message?: string; targetBadges?: ProfileBadge[]; mine?: ProfileBadge[] }>(
        "/api/badges",
        { method: "POST", body: JSON.stringify({ action, password, badge, username: action === "unlock" ? undefined : target.trim() }) }
      );
      if (action === "unlock") {
        setCatalog(response.catalog);
        setUnlocked(true);
      } else {
        setSelectedBadges(response.targetBadges ?? []);
        if (!target.trim() || target.trim().replace(/^@/, "").toLowerCase() === store.user?.username.toLowerCase()) {
          await store.refreshBadges();
        }
      }
      if (response.message) store.toast(response.message);
    } catch (e) {
      const message = (e as Error).message;
      setError(message);
      if (action === "unlock") setUnlocked(false);
    } finally {
      setBusy(null);
    }
  };

  const selectedUsername = target.trim().replace(/^@/, "") || store.user?.username || "użytkownik";
  const selected = selectedBadges;
  const has = (key: string) => selected.some((badge) => badge.badge === key);

  return <Card title="Odznaki" icon={I.medal({ size: 18 })}>
    <div data-testid="badge-admin">
      {!store.user ? <p className="text-sm text-[var(--muted)]">Zaloguj się, aby odbierać i nadawać odznaki.</p> : !unlocked ? (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (password) void send("unlock"); }}>
          <p className="text-xs text-[var(--muted)]">Odznaki nadaje się ręcznie lub automatycznie. Wpisz hasło, aby odblokować panel.</p>
          <Field label="Hasło do odznak"><input className={inputCls} type="password" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" /></Field>
          {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
          <Btn kind="primary" type="submit" disabled={!password || busy !== null}>{busy === "unlock" ? "Sprawdzam…" : "Odblokuj odznaki"}</Btn>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3"><p className="text-xs text-[var(--muted)]">Panel odblokowany. Wybierz użytkownika, aby zobaczyć i zmienić jego odznaki.</p><Btn kind="ghost" onClick={() => { setUnlocked(false); setPassword(""); setError(""); }}>Zablokuj</Btn></div>
          <Field label="Użytkownik" hint="Wpisz nazwę użytkownika; możesz też zostawić własny login.">
            <input className={inputCls} value={target} onChange={(e) => setTarget(e.target.value)} placeholder={store.user.username} />
          </Field>
          <div className="text-xs text-[var(--muted)]">Wybrany użytkownik: <strong>@{selectedUsername}</strong></div>
          <div className="grid sm:grid-cols-2 gap-2">{catalog.map((badge) => {
            const added = has(badge.key);
            return <div key={badge.key} data-badge={badge.key} className="flex items-center gap-3 rounded-lg border border-[var(--line)] bg-[var(--bg2)] px-3 py-2.5">
              <div className="min-w-0 flex-1"><div className="text-sm font-semibold">{badge.name}</div><div className="text-[11px] text-[var(--muted)] truncate">{badge.hint}</div></div>
              <Btn kind={added ? "ghost" : "soft"} disabled={busy !== null || selectedLoading} onClick={() => void send(added ? "remove" : "add", badge.key)}>
                {busy === "add" + badge.key || busy === "remove" + badge.key ? "…" : added ? "Usuń" : "Dodaj"}
              </Btn>
            </div>;
          })}</div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted2)] mb-2">Odznaki użytkownika @{selectedUsername}</div>
            {selectedLoading ? <p className="text-sm text-[var(--muted)]">Wczytywanie odznak…</p> : selected.length === 0 ? <p className="text-sm text-[var(--muted)]">Brak odznak.</p> : <div className="flex flex-wrap gap-2">{selected.map((badge) => <BadgeChip key={badge.badge} badge={badge} large />)}</div>}
          </div>
          {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
        </div>
      )}
    </div>
  </Card>;
}

export function SettingsView() {
  const store = useStore();
  const s = store.settings;
  const added = store.tracks.filter((t) => t.addedBy === store.user?.id);
  const [name, setName] = useState(store.user?.displayName ?? "");
  const [bio, setBio] = useState(store.user?.bio ?? "");
  useEffect(() => {
    setName(store.user?.displayName ?? "");
    setBio(store.user?.bio ?? "");
  }, [store.user?.id, store.user?.displayName, store.user?.bio]);
  const [brandBusy, setBrandBusy] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);
  const brandRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);
  const uploadProfileBanner = async (file?: File) => {
    if (!file) return;
    try {
      const url = await store.uploadImage(file);
      await store.saveSettings({ profileBanner: url });
      store.toast("Tło profilu zostało zapisane.");
    } catch (error) {
      store.toast((error as Error).message, "err");
    }
  };

  const uploadBrand = async (file?: File) => {
    if (!file) return;
    const data = new FormData();
    data.append("image", file);
    setBrandBusy(true);
    try {
      await api("/api/brand", { method: "POST", body: data });
      window.dispatchEvent(new Event("kocz-brand-updated"));
      store.toast("Oryginalny obrazek zapisany bez zmian");
    } catch (error) {
      store.toast((error as Error).message, "err");
    } finally {
      setBrandBusy(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <SectionHead title="Ustawienia" sub="Motyw, odtwarzanie, synchronizacja, konto i biblioteka" />

      {/* Wygląd */}
      <Card title="Wygląd" icon={I.gear({ size: 18 })}>
        <div className="py-2">
          <div className="text-sm font-semibold mb-3">Kolorystyka Koczowiska</div>
          <div className="relative mb-4 overflow-hidden rounded-xl border border-[var(--line2)] bg-[var(--bg2)] p-4 flex flex-col sm:flex-row sm:items-center gap-4">
            <KoczMark className="w-36 h-28 object-contain rounded-md shadow-sm shrink-0" alt="Oryginalny obraz KOCZ" />
            <div>
              <div className="font-display font-bold">Oryginalny obrazek KOCZ</div>
              <p className="text-xs text-[var(--muted)] mt-1 mb-3">Wgraj przesłany rysunek w formacie PNG, JPG lub WebP. Zapiszemy dokładnie ten plik, bez przerysowywania i bez obróbki. Będzie widoczny w logo aplikacji.</p>
              <Btn kind="soft" disabled={brandBusy} onClick={() => brandRef.current?.click()}>{I.upload({ size: 14 })} {brandBusy ? "Zapisywanie…" : "Wgraj oryginalny obrazek"}</Btn>
              <input ref={brandRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { void uploadBrand(e.target.files?.[0]); e.target.value = ""; }} />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {Object.entries(ACCENTS).map(([key, a]) => (
              <button
                key={key}
                type="button"
                onClick={() => void store.saveSettings({ accent: key })}
                className={`flex items-center gap-2.5 rounded-full border-2 pl-2 pr-4 py-1.5 text-sm font-semibold transition-all cursor-pointer ${
                  s.accent === key ? "scale-105" : "opacity-70 hover:opacity-100"
                }`}
                style={{ borderColor: s.accent === key ? a.accent : "var(--line2)", background: "var(--bg2)" }}
                title={a.label}
              >
                <span className="w-6 h-6 rounded-full" style={{ background: `linear-gradient(135deg, ${a.accent}, ${a.accent2})` }} />
                {a.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-[var(--muted2)] mt-2">Motyw bazowy: jasny papier z szarymi elementami. Akcent zmienia przyciski, paski i podświetlenia.</p>
        </div>
        <Row title="Animacje" sub="Pełne, zredukowane (spokojniejsze przejścia) albo całkowicie wyłączone">
          <div className="flex gap-1 p-1 bg-[var(--bg2)] rounded-lg">
            {([["full", "Pełne"], ["reduced", "Ciche"], ["off", "Wyłączone"]] as [AppSettings["animations"], string][]).map(([v, label]) => (
              <button key={v} type="button" onClick={() => void store.saveSettings({ animations: v })}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${s.animations === v ? "bg-[var(--panel2)] text-[var(--accent2)]" : "text-[var(--muted)]"}`}>
                {label}
              </button>
            ))}
          </div>
        </Row>
      </Card>

      {/* Personalizacja profilu */}
      <Card title="Wygląd profilu" icon={I.user({ size: 18 })}>
        <div className="space-y-4">
          <div>
            <div className="text-sm font-semibold mb-2">Tło profilu</div>
            <div className="flex flex-wrap gap-2">
              {([{key:"paper",label:"Papier",bg:"#f5f5f2"},{key:"night",label:"Noc",bg:"#272a30"},{key:"forest",label:"Las",bg:"#e4eee6"},{key:"sunset",label:"Zachód",bg:"#f2e5dc"}] as const).map(x => <button key={x.key} type="button" onClick={() => void store.saveSettings({profileTheme:x.key})} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${s.profileTheme===x.key?"ring-2 ring-[var(--accent)]":""}`} style={{background:x.bg,color:x.key==="night"?"#fff":"#25292e"}}>{x.label}</button>)}
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold mb-2">Kolor akcentu profilu</div>
            <div className="flex flex-wrap gap-2">
              {([{key:"graphite",label:"Grafit",color:"#535962"},{key:"red",label:"Czerwony",color:"#a33b3b"},{key:"blue",label:"Niebieski",color:"#356b9a"},{key:"green",label:"Zielony",color:"#397653"},{key:"violet",label:"Fioletowy",color:"#76549a"}] as const).map(x => <button key={x.key} type="button" onClick={() => void store.saveSettings({profileAccent:x.key})} className={`rounded-full border px-3 py-2 text-xs font-semibold flex items-center gap-2 ${s.profileAccent===x.key?"ring-2 ring-[var(--accent)]":""}`}><span className="w-3 h-3 rounded-full" style={{background:x.color}}/>{x.label}</button>)}
            </div>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-[var(--bg2)] p-3 space-y-2">
            <div className="text-sm font-semibold">Własne tło profilu</div>
            {s.profileBanner && <div className="h-24 rounded-lg bg-cover bg-center border border-[var(--line2)]" style={{ backgroundImage: `url("${s.profileBanner}")` }} />}
            <div className="flex flex-wrap gap-2">
              <Btn kind="soft" onClick={() => bannerRef.current?.click()}>Wgraj baner</Btn>
              {s.profileBanner && <Btn kind="ghost" onClick={() => void store.saveSettings({ profileBanner: "" })}>Usuń baner</Btn>}
            </div>
            <input ref={bannerRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => { void uploadProfileBanner(e.target.files?.[0]); e.target.value = ""; }} />
            <p className="text-[11px] text-[var(--muted2)]">PNG, JPG lub WebP, maksymalnie 5 MB.</p>
          </div>
          <Row title="Prywatność profilu" sub="Wybierz, kto może przeglądać Twoją stronę">
            <select className="rounded-lg border border-[var(--line2)] bg-[var(--bg)] px-3 py-2 text-xs" value={s.profileVisibility} onChange={e => void store.saveSettings({profileVisibility:e.target.value as AppSettings["profileVisibility"]})}>
              <option value="public">Wszyscy</option><option value="friends">Znajomi</option><option value="private">Tylko ja</option>
            </select>
          </Row>
          <Row title="Pokazuj ostatnią aktywność" sub="Kontroluje wyświetlanie sekcji aktywności na profilu">
            <Toggle on={s.profileShowActivity} onChange={v => void store.saveSettings({profileShowActivity:v})} label="Aktywność" />
          </Row>
        </div>
      </Card>

      {/* Odtwarzanie */}
      <Card title="Odtwarzanie" icon={I.music({ size: 18 })}>
        <Row title="Automatycznie następny utwór" sub="Przy końcu utworu od razu uruchamia kolejny z kolejki">
          <Toggle on={s.autoplayNext} onChange={(v) => void store.saveSettings({ autoplayNext: v })} label="Autoplay" />
        </Row>
        <Row title="Wznawianie pozycji" sub="Po pauzie wracasz do miejsca, w którym zatrzymałeś muzykę">
          <Toggle on={s.resumePosition} onChange={(v) => void store.saveSettings({ resumePosition: v })} label="Wznawianie" />
        </Row>
      </Card>

      {/* Synchronizacja */}
      <Card title="Synchronizacja" icon={I.share({ size: 18 })}>
        <Row title="Automatyczna synchronizacja" sub="Co minutę sprawdzamy playlisty, polubienia i grupę na serwerze">
          <Toggle on={s.autoSync} onChange={(v) => void store.saveSettings({ autoSync: v })} label="Auto sync" />
        </Row>
        <Row title="Ostatnia synchronizacja" sub={store.online ? "Połączenie z serwerem aktywne" : "Brak połączenia – tryb lokalny (cache)"}>
          <span className={`text-xs font-semibold ${store.online ? "text-emerald-700" : "text-amber-700"}`}>
            {store.lastSync ? store.lastSync.toLocaleTimeString("pl-PL") : "—"}
          </span>
        </Row>
        <p className="text-xs text-[var(--muted2)] mt-3">
          Playlisty, polubienia, ustawienia i statystyki są zapisane w bazie Koczowiska. Na innym urządzeniu użyj tego samego adresu serwera i zaloguj się na swoje konto.
        </p>
      </Card>

      {/* Społeczność */}
      <Card title="Społeczność" icon={I.users({ size: 18 })}>
        <Row title="Funkcje społecznościowe" sub="Komentarze, obserwowanie, grupy i polubienia. Możesz je całkowicie wyłączyć.">
          <Toggle on={s.social} onChange={(v) => void store.saveSettings({ social: v })} label="Społeczność" />
        </Row>
      </Card>

      <BadgeAdminCard Card={Card} />

      {/* Konto */}
      <Card title="Konto" icon={I.user({ size: 18 })}>
        {store.user ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar user={store.user} size={56} />
              <div className="flex-1">
                <div className="text-sm font-semibold">@{store.user.username}</div>
                <div className="text-xs text-[var(--muted)]">Twoje konto koczowiska</div>
              </div>
              <Btn kind="soft" onClick={() => avatarRef.current?.click()}>
                {I.upload({ size: 14 })} Awatar
              </Btn>
              <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void store.uploadAvatar(f);
                e.target.value = "";
              }} />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Nazwa wyświetlana">
                <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Bio">
                <input className={inputCls} value={bio} onChange={(e) => setBio(e.target.value)} />
              </Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <Btn kind="primary" disabled={!name.trim()} onClick={async () => {
                await store.updateProfile(name.trim(), bio.trim());
                store.closeModal();
              }}>
                Zapisz profil
              </Btn>
              <Btn kind="ghost" onClick={() => void store.logout()}>
                {I.logout({ size: 15 })} Wyloguj się
              </Btn>
              <Btn kind="danger" onClick={() => store.openModal({ type: "confirm-delete-account" })}>
                {I.trash({ size: 15 })} Usuń konto
              </Btn>
            </div>
          </div>
        ) : (
          <div className="text-sm text-[var(--muted)]">
            Nie jesteś zalogowany. <button type="button" className="text-[var(--accent2)] cursor-pointer hover:underline" onClick={() => store.openModal({ type: "auth" })}>Załóż konto</button>, aby synchronizować playlisty i statystyki.
          </div>
        )}
      </Card>

      {/* Biblioteka */}
      <Card title="Biblioteka muzyczna" icon={I.library({ size: 18 })}>
        <p className="text-xs text-[var(--muted)] mb-4">
          Twoje pliki MP3, WAV i OGG są zapisane na serwerze Koczowiska. Przeglądarka odtwarza je strumieniowo; dostęp do biblioteki i zapisywanie zmian wymagają połączenia z serwerem.
        </p>
        {added.length === 0 ? (
          <p className="text-sm text-[var(--muted2)]">Nie dodałeś jeszcze własnych plików.</p>
        ) : (
          <div className="space-y-1">
            {added.map((t) => (
              <div key={t.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-[var(--hover)]">
                <div className="w-9 h-9 rounded-md overflow-hidden bg-[var(--panel2)] shrink-0">
                  <Cover src={t.cover} alt="" className="w-full h-full" iconSize={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{t.title}</div>
                  <div className="text-xs text-[var(--muted)] truncate">{t.artist} • {fmtTime(t.duration)}</div>
                </div>
                <IconBtn title="Usuń plik" onClick={() => {
                  if (confirm(`Usunąć „${t.title}” z biblioteki?`)) void store.deleteTrack(t.id);
                }}>
                  {I.trash({ size: 15, className: "text-red-600" })}
                </IconBtn>
              </div>
            ))}
          </div>
        )}
      </Card>

      <p className="text-center text-[11px] text-[var(--muted2)] pb-4">
        Koczowisko 3.0 • niezależna platforma muzyczna • rozpal z głową
      </p>
    </div>
  );
}
