"use client";
import { useEffect, useMemo, useState } from "react";
import { api, useStore } from "./ctx";
import type { CommentItem, LyricsDoc, Track } from "@/lib/types";
import { fmtLong, fmtTime, timeAgo } from "@/lib/types";
import { Avatar, BadgeDots, Btn, Cover, Field, I, IconBtn, inputCls, KoczMark, Modal, PlaylistCard, Toggle } from "./ui";

/* ================= AUTH ================= */

export function AuthModal() {
  const store = useStore();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [f, setF] = useState({ username: "", email: "", password: "", displayName: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setErr(""); setBusy(true);
    try {
      const error = tab === "login"
        ? await store.login(f.username.trim(), f.password)
        : await store.register({ ...f, username: f.username.trim(), email: f.email.trim() });
      if (error) setErr(error);
      else store.closeModal();
    } finally { setBusy(false); }
  };

  return (
    <Modal title="Koczowisko" onClose={store.closeModal}>
      <div className="mb-5 rounded-xl border border-[var(--line2)] bg-[var(--bg2)] p-4 text-center">
        <KoczMark className="w-24 h-16 object-contain mx-auto mb-2 rounded" alt="KOCZ" />
        <p className="font-display font-bold text-lg">Twój zeszyt, Twoja muzyka</p>
        <p className="text-sm text-[var(--muted)]">Playlisty i grupy zapisane na Twoim koncie.</p>
      </div>
      <div className="grid grid-cols-2 gap-1 p-1 bg-[var(--bg2)] rounded-lg mb-5" role="tablist" aria-label="Dostęp do konta">
        {(["login", "register"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} type="button" disabled={busy}
            onClick={() => { setTab(t); setErr(""); setF((v) => ({ ...v, password: "" })); }}
            className={`py-2 rounded-md text-sm font-semibold cursor-pointer ${tab === t ? "bg-[var(--panel)] shadow-sm" : "text-[var(--muted)]"}`}>
            {t === "login" ? "Zaloguj się" : "Załóż konto"}
          </button>
        ))}
      </div>
      <form className="space-y-3.5" onSubmit={submit} aria-label={tab === "login" ? "Logowanie" : "Rejestracja"}>
        <Field label={tab === "login" ? "Nazwa użytkownika lub e-mail" : "Nazwa użytkownika"}>
          <input className={inputCls} name="username" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false}
            required autoFocus maxLength={tab === "login" ? 254 : 20} pattern={tab === "register" ? "[a-z0-9_]{3,20}" : undefined}
            title={tab === "register" ? "3–20 znaków: małe litery, cyfry lub podkreślenie" : undefined}
            value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })}
            placeholder={tab === "login" ? "Login lub adres e-mail" : "np. moj_login"} />
        </Field>
        {tab === "register" && <>
          <Field label="Nazwa wyświetlana"><input className={inputCls} name="displayName" autoComplete="nickname" maxLength={40} value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} placeholder="Jak mamy Cię nazywać?" /></Field>
          <Field label="E-mail"><input className={inputCls} name="email" type="email" autoComplete="email" autoCapitalize="none" maxLength={254} required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="ty@example.com" /></Field>
        </>}
        <Field label="Hasło" hint={tab === "register" ? "Minimum 6 znaków." : undefined}>
          <input className={inputCls} name="password" type="password" required maxLength={256} minLength={tab === "register" ? 6 : undefined}
            autoComplete={tab === "login" ? "current-password" : "new-password"}
            value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="••••••••" />
        </Field>
        {tab === "login" && <p className="text-xs text-[var(--muted)]">Logowanie zostaje zapamiętane na tym urządzeniu. Na wspólnym komputerze wyloguj się po użyciu.</p>}
        {err && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}
        <Btn kind="primary" className="w-full" type="submit" disabled={busy || !f.password || !f.username.trim() || (tab === "register" && !f.email.trim())}>
          {busy ? "Chwileczkę…" : tab === "login" ? "Zaloguj się" : "Utwórz konto"}
        </Btn>
      </form>
    </Modal>
  );
}

/* ================= PLAYLISTA: utworz / edycja ================= */

export function PlaylistModal({ id }: { id?: string }) {
  const store = useStore();
  const existing = id ? store.findPlaylist(id) : undefined;
  const [name, setName] = useState(existing?.name ?? "");
  const [desc, setDesc] = useState(existing?.description ?? "");
  const [priv, setPriv] = useState(existing?.isPrivate ?? false);
  const [cover, setCover] = useState<string | null>(existing?.cover ?? null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const presets = ["/api/brand", "/covers/wybrzeze.png", "/covers/wedrowka.png", "/covers/cisza.png"];

  const onCoverFile = async (file: File | null) => {
    if (!file) return;
    try {
      const url = await store.uploadImage(file);
      setCover(url);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const save = async () => {
    setErr("");
    if (!name.trim()) return setErr("Podaj nazwę playlisty");
    setBusy(true);
    if (existing) {
      await store.updatePlaylist(existing.id, { name, description: desc, isPrivate: priv, cover: cover ?? "" });
    } else {
      const pid = await store.createPlaylist({ name, description: desc, isPrivate: priv });
      if (pid && cover) await store.updatePlaylist(pid, { cover });
      if (pid) store.setView({ name: "playlist", id: pid });
    }
    setBusy(false);
    store.closeModal();
  };

  const del = async () => {
    if (!existing) return;
    if (confirm("Na pewno usunąć tę playlistę? Tej operacji nie można cofnąć.")) {
      await store.deletePlaylist(existing.id);
      store.closeModal();
    }
  };

  return (
    <Modal title={existing ? "Edytuj playlistę" : "Nowa playlista"} onClose={store.closeModal}>
      <div className="space-y-4">
        <div className="flex items-start gap-4">
          <div className="w-24 h-24 rounded-xl overflow-hidden border border-[var(--line2)] shrink-0">
            <Cover src={cover} alt="okładka" className="w-full h-full" />
          </div>
          <div className="flex-1 space-y-2">
            <label className="block text-xs text-[var(--muted)]">Okładka</label>
            <div className="flex flex-wrap gap-2">
              {presets.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setCover(p)}
                  className={`w-10 h-10 rounded-md overflow-hidden border-2 transition-all cursor-pointer ${
                    cover === p ? "border-[var(--accent)] scale-105" : "border-transparent opacity-70 hover:opacity-100"
                  }`}
                >
                  <Cover src={p} alt="Podgląd okładki" className="w-full h-full" iconSize={15} />
                </button>
              ))}
              <label className="w-10 h-10 rounded-md border border-dashed border-[var(--line2)] flex items-center justify-center cursor-pointer hover:border-[var(--accent)] transition-colors text-[var(--muted)]">
                {I.upload({ size: 15 })}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => onCoverFile(e.target.files?.[0] ?? null)} />
              </label>
            </div>
          </div>
        </div>
        <Field label="Nazwa">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Np. Fioletowe wieczory" autoFocus />
        </Field>
        <Field label="Opis">
          <textarea className={inputCls} rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="O czym jest ta playlista?" />
        </Field>
        <div className="flex items-center justify-between rounded-lg border border-[var(--line)] px-4 py-3">
          <div>
            <div className="text-sm font-semibold">Prywatna playlista</div>
            <div className="text-xs text-[var(--muted)]">Tylko Ty ją zobaczysz i odsłuchasz.</div>
          </div>
          <Toggle on={priv} onChange={setPriv} label="Prywatna" />
        </div>
        {err && <p className="text-sm text-red-700">{err}</p>}
        <div className="flex gap-2 justify-end">
          {existing && (
            <Btn kind="danger" onClick={del}>
              {I.trash({ size: 15 })} Usuń
            </Btn>
          )}
          <Btn kind="primary" onClick={save} disabled={busy}>
            {existing ? "Zapisz zmiany" : "Utwórz playlistę"}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

/* ================= DODAJ DO PLAYLISTY ================= */

export function AddToPlaylistModal({ trackId }: { trackId: string }) {
  const store = useStore();
  const [sel, setSel] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const track = store.findTrack(trackId);
  const mine = store.myPlaylists;

  return (
    <Modal title="Dodaj do playlisty" onClose={store.closeModal}>
      {track && (
        <div className="flex items-center gap-3 mb-4 p-2 rounded-lg bg-[var(--bg2)]">
          <div className="w-10 h-10 rounded-md overflow-hidden">
            <Cover src={track.cover} alt="" className="w-full h-full" iconSize={16} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{track.title}</div>
            <div className="text-xs text-[var(--muted)] truncate">{track.artist}</div>
          </div>
        </div>
      )}
      {!store.user ? (
        <div className="text-center py-6 space-y-3">
          <p className="text-sm text-[var(--muted)]">Zaloguj się, aby tworzyć playlisty i dodawać do nich utwory.</p>
          <Btn kind="primary" onClick={() => store.openModal({ type: "auth" })}>Zaloguj się</Btn>
        </div>
      ) : mine.length === 0 ? (
        <div className="text-center py-6 space-y-3">
          <p className="text-sm text-[var(--muted)]">Nie masz jeszcze playlist. Stwórz pierwszą, aby dodać utwory.</p>
          <Btn kind="soft" onClick={() => store.openModal({ type: "playlist-create" })}>{I.plus({ size: 14 })} Utwórz pierwszą playlistę</Btn>
        </div>
      ) : (
        <div className="space-y-1 max-h-[46vh] overflow-y-auto pr-1">
          {mine.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSel(p.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer ${
                sel === p.id ? "bg-[var(--accent)]/15 ring-1 ring-[var(--accent)]" : "hover:bg-[var(--hover)]"
              }`}
            >
              <div className="w-9 h-9 rounded-md overflow-hidden shrink-0">
                <Cover src={p.cover} alt="" className="w-full h-full" iconSize={14} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate">{p.name}</div>
                <div className="text-xs text-[var(--muted)]">{p.tracks.length} utworów</div>
              </div>
              {sel === p.id && I.check({ size: 16, className: "text-[var(--accent)]" })}
            </button>
          ))}
        </div>
      )}
      {err && <p className="text-sm text-red-700 mt-3">{err}</p>}
      <div className="flex justify-end gap-2 mt-4">
        <Btn
          kind="primary"
          disabled={!sel}
          onClick={async () => {
            if (!sel) return;
            setErr("");
            await store.addToPlaylist(sel, trackId);
            if (!store.myPlaylists.find((p) => p.id === sel)) return;
            store.closeModal();
          }}
        >
          Dodaj
        </Btn>
      </div>
    </Modal>
  );
}

/* ================= DODAWANIE UTWORÓW DO PLAYLISTY ================= */

export function PlaylistAddModal({ playlistId }: { playlistId: string }) {
  const store = useStore();
  const pl = store.findPlaylist(playlistId);
  const [q, setQ] = useState("");
  const inPl = new Set(pl?.tracks.map((t) => t.id) ?? []);
  const list = store.tracks.filter((t) => !q.trim() || [t.title, t.artist, t.album].some((s) => s.toLowerCase().includes(q.trim().toLowerCase())));

  return (
    <Modal title={`Dodaj utwory: ${pl?.name ?? ""}`} onClose={store.closeModal}>
      <input className={inputCls} placeholder="Szukaj w bibliotece…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      <div className="mt-3 space-y-0.5 max-h-[52vh] overflow-y-auto pr-1">
        {list.length === 0 && <p className="text-sm text-[var(--muted)] text-center py-6">Brak utworów w bibliotece.</p>}
        {list.map((t) => (
          <div key={t.id} className={`flex items-center gap-3 px-2.5 py-2 rounded-lg ${inPl.has(t.id) ? "opacity-45" : "hover:bg-[var(--hover)]"}`}>
            <div className="w-9 h-9 rounded-md overflow-hidden bg-[var(--panel2)] shrink-0">
              <Cover src={t.cover} alt="" className="w-full h-full" iconSize={14} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{t.title}</div>
              <div className="text-xs text-[var(--muted)] truncate">{t.artist}</div>
            </div>
            {inPl.has(t.id) ? (
              <span className="text-xs text-[var(--muted2)] flex items-center gap-1">{I.check({ size: 13 })} w playlistach</span>
            ) : (
              <Btn kind="soft" onClick={() => store.addToPlaylist(playlistId, t.id)}>
                {I.plus({ size: 13 })} Dodaj
              </Btn>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}

/* ================= WGRANIE WŁASNYCH PLIKÓW ================= */

function readDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const a = new Audio();
    a.preload = "metadata";
    const done = (v: number) => {
      URL.revokeObjectURL(url);
      resolve(v);
    };
    a.onloadedmetadata = () => done(Math.round(a.duration) || 0);
    a.onerror = () => done(0);
    a.src = url;
  });
}

interface UploadRow {
  file: File;
  title: string;
  artist: string;
  album: string;
  duration: number;
}

export function UploadFilesModal({ files }: { files: File[] }) {
  const store = useStore();
  const [rows, setRows] = useState<UploadRow[]>(() =>
    files.map((f) => ({
      file: f,
      title: f.name.replace(/\.[^.]+$/, ""),
      artist: "Moje utwory",
      album: "",
      duration: 0,
    }))
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    rows.forEach((r, i) => {
      if (r.duration > 0) return;
      readDuration(r.file).then((d) => {
        if (!alive) return;
        setRows((prev) => prev.map((x, xi) => (xi === i ? { ...x, duration: d } : x)));
      });
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  const set = (i: number, k: keyof UploadRow, v: string) =>
    setRows((prev) => prev.map((x, xi) => (xi === i ? { ...x, [k]: v } : x)));

  return (
    <Modal title={`Dodaj pliki (${files.length})`} onClose={store.closeModal} wide>
      <p className="text-sm text-[var(--muted)] mb-4">
        Własna muzyka z Twojego komputera (MP3, WAV, OGG). Zostanie w bibliotecie Koczowiska i będzie synchronizowana z Twoim kontem.
      </p>
      <div className="space-y-3 max-h-[52vh] overflow-y-auto pr-1">
        {rows.map((r, i) => (
          <div key={i} className="rounded-xl border border-[var(--line)] bg-[var(--bg2)] p-3.5">
            <div className="flex items-center gap-2 text-xs text-[var(--muted2)] mb-2.5">
              {I.music({ size: 13 })} {r.file.name}
              <span className="ml-auto">{(r.file.size / 1024 / 1024).toFixed(1)} MB{r.duration ? ` • ${fmtTime(r.duration)}` : " • odczyt czasu…"}</span>
            </div>
            <div className="grid sm:grid-cols-3 gap-2.5">
              <Field label="Tytuł">
                <input className={inputCls} value={r.title} onChange={(e) => set(i, "title", e.target.value)} />
              </Field>
              <Field label="Wykonawca">
                <input className={inputCls} value={r.artist} onChange={(e) => set(i, "artist", e.target.value)} />
              </Field>
              <Field label="Album">
                <input className={inputCls} value={r.album} onChange={(e) => set(i, "album", e.target.value)} />
              </Field>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <Btn
          kind="primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await store.uploadTracks(rows.map((r) => ({ file: r.file, meta: { title: r.title.trim() || r.file.name, artist: r.artist.trim() || "Moje utwory", album: r.album.trim(), duration: r.duration } })));
            setBusy(false);
            store.closeModal();
          }}
        >
          {I.upload({ size: 15 })} {busy ? "Wgrywanie…" : "Dodaj do biblioteki"}
        </Btn>
      </div>
    </Modal>
  );
}

/* ================= UDOSTĘPNIANIE ================= */

export function ShareModal({ kind, id, name }: { kind: "playlist" | "profile"; id: string; name: string }) {
  const store = useStore();
  const [copied, setCopied] = useState(false);
  const url =
    kind === "playlist"
      ? `${window.location.origin}/?p=${id}`
      : `${window.location.origin}/?u=${id}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    store.toast("Link skopiowany do schowka");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal title="Udostępnij" onClose={store.closeModal}>
      <p className="text-sm text-[var(--muted)] mb-4">
        Każdy z linkiem zobaczy „{name}” w Koczowisku – nawet na innym urządzeniu.
      </p>
      <div className="flex gap-2">
        <input readOnly value={url} className={inputCls} onFocus={(e) => e.target.select()} />
        <Btn kind="primary" onClick={copy}>
          {copied ? I.check({ size: 16 }) : I.share({ size: 16 })}
          {copied ? "Skopiowano" : "Kopiuj"}
        </Btn>
      </div>
    </Modal>
  );
}

/* ================= SZCZEGÓŁY UTWORU + KOMENTARZE ================= */

export function TrackDetailModal({ trackId }: { trackId: string }) {
  const store = useStore();
  const track = store.findTrack(trackId);
  const [comments, setComments] = useState<CommentItem[] | null>(null);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    api<{ comments: CommentItem[] }>(`/api/comments?trackId=${trackId}`)
      .then((r) => setComments(r.comments))
      .catch(() => setComments([]));
  };
  useEffect(load, [trackId]);

  const post = async (parentId: string | null) => {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    try {
      const r = await api<{ comments: CommentItem[] }>(`/api/comments`, {
        method: "POST",
        body: JSON.stringify({ trackId, body, parentId }),
      });
      setComments(r.comments);
      setText("");
      setReplyTo(null);
    } catch (e) {
      store.toast((e as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };

  if (!track) return null;

  return (
    <Modal title="Utwór" onClose={store.closeModal} wide>
      <div className="flex items-center gap-4 mb-5">
        <div className="w-20 h-20 rounded-xl overflow-hidden border border-[var(--line2)] shrink-0">
          <Cover src={track.cover} alt="" className="w-full h-full" iconSize={26} />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="font-display font-bold text-xl truncate">{track.title}</h4>
          <p className="text-sm text-[var(--muted)]">
            {track.artist} {track.album ? `• ${track.album}` : ""} • {fmtTime(track.duration)}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <span className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
              {I.heart({ size: 13, filled: track.liked, className: track.liked ? "text-[var(--accent)]" : "" })}
              {track.likes}
            </span>
            {track.hasLyrics && (
              <button
                type="button"
                className="text-xs text-[var(--accent2)] koc-underline cursor-pointer"
                onClick={() => store.openModal({ type: "lyrics-edit", trackId })}
              >
                {I.book({ size: 13 })} Zobacz tekst
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-[var(--line)] pt-4">
        <h5 className="font-display font-bold mb-3 flex items-center gap-2">
          {I.users({ size: 16 })} Komentarze do utworu
          <span className="text-xs font-normal text-[var(--muted)]">({comments?.length ?? 0})</span>
        </h5>
        {comments === null ? (
          <p className="text-sm text-[var(--muted)] py-4 text-center">Ładowanie…</p>
        ) : (
          <div className="space-y-3 max-h-[38vh] overflow-y-auto pr-1">
            {comments.length === 0 && (
              <p className="text-sm text-[var(--muted)] text-center py-4">Jeszcze cisza. Porozmawiajmy o tym utworze.</p>
            )}
            {comments.map((c) => (
              <div key={c.id} className="rounded-xl bg-[var(--bg2)] border border-[var(--line)] p-3.5">
                <div className="flex items-center gap-2.5">
                  <Avatar user={c.user} size={30} />
                  <div className="min-w-0">
                    <button
                      type="button"
                      className="text-sm font-semibold hover:underline cursor-pointer"
                      onClick={() => {
                        store.closeModal();
                        store.setView({ name: "profile", username: c.user.username });
                      }}
                    >
                      {c.user.displayName}
                    </button>
                    <BadgeDots badges={c.user.badges} />
                    <span className="text-[11px] text-[var(--muted2)] ml-2">{timeAgo(c.createdAt)}</span>
                  </div>
                </div>
                <p className="text-sm mt-2 leading-relaxed">{c.body}</p>
                <button
                  type="button"
                  className="text-xs text-[var(--accent2)] mt-2 cursor-pointer hover:underline"
                  onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}
                >
                  Odpowiedz
                </button>
                {c.replies.length > 0 && (
                  <div className="mt-3 space-y-2.5 border-l-2 border-[var(--line2)] pl-3">
                    {c.replies.map((r) => (
                      <div key={r.id}>
                        <div className="flex items-center gap-2">
                          <Avatar user={r.user} size={22} />
                          <span className="text-xs font-semibold">{r.user.displayName}</span>
                          <BadgeDots badges={r.user.badges} max={2} />
                          <span className="text-[10px] text-[var(--muted2)]">{timeAgo(r.createdAt)}</span>
                        </div>
                        <p className="text-sm mt-1">{r.body}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex gap-2 items-start">
          <Avatar user={store.user ?? { displayName: "Gość", avatar: null, username: "gość", id: "", bio: "", isSystem: false }} size={32} />
          <div className="flex-1">
            {replyTo && (
              <div className="text-[11px] text-[var(--accent2)] mb-1 flex items-center gap-2">
                Odpowiadasz na komentarz…
                <button type="button" className="cursor-pointer hover:underline" onClick={() => setReplyTo(null)}>
                  anuluj
                </button>
              </div>
            )}
            <textarea
              className={inputCls}
              rows={2}
              placeholder={store.user ? "Podziel się wrażeniami…" : "Zaloguj się, aby komentować"}
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={!store.user}
            />
            <div className="flex justify-end gap-2 mt-2">
              {!store.user && (
                <Btn kind="ghost" onClick={() => store.openModal({ type: "auth" })}>
                  Zaloguj się
                </Btn>
              )}
              <Btn kind="soft" disabled={!store.user || !text.trim() || busy} onClick={() => post(replyTo)}>
                {busy ? "Wysyłanie…" : "Opublikuj"}
              </Btn>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ================= TEKST UTWORU ================= */

export function LyricsEditModal({ trackId }: { trackId: string }) {
  const store = useStore();
  const track = store.findTrack(trackId);
  const [doc, setDoc] = useState<LyricsDoc | null>(null);
  const [text, setText] = useState("");
  const [editing, setEditing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    api<{ lyrics: LyricsDoc | null }>(`/api/lyrics?trackId=${trackId}`)
      .then((r) => {
        setDoc(r.lyrics);
        if (r.lyrics) {
          setText(r.lyrics.lines.map((l) => (l.t !== undefined ? `${fmtTime(l.t)} - ${l.x}` : l.x)).join("\n"));
          setEditing(false);
        } else {
          setText("");
          setEditing(!!store.user);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId]);

  const save = async () => {
    try {
      await store.saveLyrics(trackId, text);
      const r = await api<{ lyrics: LyricsDoc | null }>(`/api/lyrics?trackId=${trackId}`);
      setDoc(r.lyrics);
      setEditing(false);
    } catch (e) {
      store.toast((e as Error).message, "err");
    }
  };

  return (
    <Modal title={track ? `Tekst: ${track.title}` : "Tekst utworu"} onClose={store.closeModal} wide>
      {loaded && doc && !editing ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-[var(--muted)]">
              {doc.synced ? "Tekst zsynchronizowany z czasem odtwarzania" : "Tekst niesynchronizowany"}
              {doc.authorName ? ` • dodane przez ${doc.authorName}` : ""}
            </div>
            <Btn kind="soft" onClick={() => setEditing(true)}>
              {I.edit({ size: 14 })} Zmień
            </Btn>
          </div>
          <div className="rounded-xl bg-[var(--bg2)] border border-[var(--line)] p-5 space-y-2 max-h-[50vh] overflow-y-auto">
            {doc.lines.map((l, i) => (
              <div key={i} className="flex gap-3">
                {l.t !== undefined && (
                  <span className="text-[10px] tabular-nums text-[var(--accent2)] pt-0.5 w-9 shrink-0">{fmtTime(l.t)}</span>
                )}
                <span className="text-sm leading-relaxed">{l.x}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <Field
            label="Tekst utworu"
            hint="Jedna linijka w jednym wierszu. Opcjonalny znacznik czasu na początku (np. 0:04 - to jest linijka) tworzy tekst zsynchronizowany."
          >
            <textarea
              className={`${inputCls} font-mono text-[13px] leading-relaxed`}
              rows={12}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"0:01 - Jedna kreska, jeden dźwięk\n0:05 - zaczynamy wspólny szkic\n0:09 - (następna linijka)"}
              autoFocus
              disabled={!store.user}
            />
          </Field>
          {!store.user && <p className="text-sm text-[var(--muted)]">Zaloguj się, aby dodać tekst.</p>}
          <p className="text-[11px] text-[var(--muted2)]">
            Teksty w Koczowisku dodają użytkownicy – dodawaj wyłącznie utwory, których publikowanie możesz legalnie udostępnić (utwory autorskie, domena publiczna, CC).
          </p>
          <div className="flex justify-end gap-2">
            {doc && (
              <Btn kind="ghost" onClick={() => setEditing(false)}>
                Anuluj
              </Btn>
            )}
            <Btn kind="primary" disabled={!store.user || !text.trim()} onClick={save}>
              Zapisz tekst
            </Btn>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ================= GRUPA: utworz ================= */

export function GroupCreateModal({ onCreated }: { onCreated?: (id: string) => void }) {
  const store = useStore();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim() || busy) return;
    setErr("");
    setBusy(true);
    const id = await store.createGroup(name.trim(), desc.trim());
    setBusy(false);
    if (id) {
      store.closeModal();
      onCreated?.(id);
    }
  };

  return (
    <Modal title="Nowa grupa muzyczna" onClose={store.closeModal}>
      <div className="space-y-4">
        <Field label="Nazwa grupy">
          <input
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Np. Wieczorny odsłuch"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && void submit()}
          />
        </Field>
        <Field label="Opis">
          <textarea className={inputCls} rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="O czym jest ta grupa?" />
        </Field>
        {err && <p className="text-sm text-red-700">{err}</p>}
        <div className="flex justify-end">
          <Btn kind="primary" disabled={!name.trim() || busy} onClick={() => void submit()}>
            {busy ? "Tworzenie…" : "Utwórz grupę"}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

/* ================= PROFIL: edycja ================= */

export function ProfileEditModal() {
  const store = useStore();
  const u = store.user!;
  const [name, setName] = useState(u.displayName);
  const [bio, setBio] = useState(u.bio);

  return (
    <Modal title="Edytuj profil" onClose={store.closeModal}>
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Avatar user={{ displayName: name || u.displayName, avatar: u.avatar }} size={64} />
          <label className="cursor-pointer">
            <span className="inline-flex items-center gap-2 rounded-lg border border-[var(--line2)] px-4 py-2 text-sm font-semibold hover:bg-[var(--hover)] transition-colors">
              {I.upload({ size: 15 })} Zmień awatar
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) store.uploadAvatar(f);
              }}
            />
          </label>
        </div>
        <Field label="Nazwa wyświetlana">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Bio" hint="Krótko o Tobie i Twojej muzyce.">
          <textarea className={inputCls} rows={3} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Koczę się przy gitarze od…" />
        </Field>
        <div className="flex justify-end gap-2">
          <Btn kind="soft" disabled={!name.trim()} onClick={async () => {
            await store.updateProfile(name.trim(), bio.trim());
            store.closeModal();
          }}>
            Zapisz profil
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

/* ================= USUŃ KONTO ================= */

export function ConfirmDeleteAccountModal() {
  const store = useStore();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");

  return (
    <Modal title="Usuń konto" onClose={store.closeModal}>
      <div className="space-y-4">
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-800">
          Ta operacja trwale usunie Twoje konto, playlisty, polubienia, komentarze i historię słuchania.
          Utwory dodane przez Ciebie zostaną usunięte z biblioteki.
        </div>
        <Field label="Potwierdź hasłem">
          <input className={inputCls} type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Twoje hasło" />
        </Field>
        {err && <p className="text-sm text-red-700">{err}</p>}
        <div className="flex justify-end gap-2">
          <Btn
            kind="danger"
            onClick={async () => {
              if (!pw) return setErr("Wpisz hasło, aby potwierdzić");
              await store.deleteAccount(pw);
            }}
          >
            {I.trash({ size: 15 })} Definitywnie usuń konto
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

/* ================= Dyspozyter ================= */

export function ModalHost() {
  const store = useStore();
  const m = store.modal;
  if (!m) return null;
  switch (m.type) {
    case "auth":
      return <AuthModal />;
    case "playlist-create":
      return <PlaylistModal />;
    case "playlist-edit":
      return <PlaylistModal id={String(m.id)} />;
    case "add-to-playlist":
      return <AddToPlaylistModal trackId={String(m.trackId)} />;
    case "playlist-add":
      return <PlaylistAddModal playlistId={String(m.playlistId)} />;
    case "upload-files":
      return <UploadFilesModal files={m.files as File[]} />;
    case "share":
      return <ShareModal kind={m.kind as "playlist" | "profile"} id={String(m.id)} name={String(m.name)} />;
    case "track-detail":
      return <TrackDetailModal trackId={String(m.trackId)} />;
    case "lyrics-edit":
      return <LyricsEditModal trackId={String(m.trackId)} />;
    case "group-create":
      return <GroupCreateModal onCreated={(id) => store.setView({ name: "group", id })} />;
    case "profile-edit":
      return <ProfileEditModal />;
    case "confirm-delete-account":
      return <ConfirmDeleteAccountModal />;
    default:
      return null;
  }
}

export { PlaylistCard as _PC };
