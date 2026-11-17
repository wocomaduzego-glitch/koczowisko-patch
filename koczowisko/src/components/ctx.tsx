"use client";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  AppSettings,
  ProfileBadge,
  GroupLite,
  Playlist,
  StatsData,
  Track,
  UserLite,
  View,
} from "@/lib/types";
import { ACCENTS, DEFAULT_SETTINGS, trackUrl } from "@/lib/types";

/* ================= API helper ================= */

/** Token sesji zapisany w przeglądarce – dzięki niemu logowanie zostaje po odświeżeniu strony,
 *  restarcie serwera i działa także tam, gdzie przeglądarka blokuje ciasteczka (np. w ramce). */
const TOKEN_KEY = "koc_token";
const CACHE_KEY = "koc_web_cache_v2";
let memoryToken: string | null = null;
function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? memoryToken;
  } catch {
    return memoryToken;
  }
}
function saveToken(token?: string | null) {
  memoryToken = token ?? null;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* tryb prywatny – zostaje samo ciasteczko */
  }
}

export async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  const headers: Record<string, string> = { ...(init?.headers as Record<string, string> | undefined) };
  if (init && init.body && !(init.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const token = readToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  try {
    res = await fetch(path, { credentials: "include", cache: "no-store", ...init, headers });
  } catch {
    throw Object.assign(new Error("offline"), { offline: true });
  }
  if (!res.ok) {
    let msg = "Coś poszło nie tak. Spróbuj ponownie.";
    try {
      const j = await res.json();
      if (j && j.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw Object.assign(new Error(msg), { status: res.status });
  }
  return (await res.json()) as T;
}

/* ================= Store ================= */

export interface ModalState {
  type:
    | "auth"
    | "playlist-create"
    | "playlist-edit"
    | "add-to-playlist"
    | "playlist-add"
    | "upload-files"
    | "share"
    | "track-detail"
    | "lyrics-edit"
    | "group-create"
    | "profile-edit"
    | "confirm-delete-account";
  [key: string]: unknown;
}

interface Toast {
  id: number;
  msg: string;
  kind: "ok" | "err";
}

interface Store {
  loading: boolean;
  online: boolean;
  lastSync: Date | null;
  user: UserLite | null;
  settings: AppSettings;
  tracks: Track[];
  myPlaylists: Playlist[];
  publicPlaylists: Playlist[];
  groups: GroupLite[];
  stats: StatsData | null;
  view: View;
  setView: (v: View) => void;
  modal: ModalState | null;
  openModal: (m: ModalState) => void;
  closeModal: () => void;
  toasts: Toast[];
  toast: (msg: string, kind?: "ok" | "err") => void;
  refresh: () => Promise<void>;
  refreshStats: () => Promise<void>;
  findPlaylist: (id: string) => Playlist | undefined;
  findTrack: (id: string) => Track | undefined;
  likedTracks: Track[];
  badges: ProfileBadge[];
  refreshBadges: () => Promise<void>;

  login: (username: string, password: string) => Promise<string | null>;
  register: (f: { username: string; email: string; password: string; displayName: string }) => Promise<string | null>;
  logout: () => Promise<void>;
  updateProfile: (displayName: string, bio: string) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
  saveSettings: (patch: Partial<AppSettings>) => Promise<void>;

  uploadTracks: (files: { file: File; meta: { title: string; artist: string; album: string; duration: number } }[]) => Promise<number>;
  deleteTrack: (id: string) => Promise<void>;
  createPlaylist: (d: { name: string; description: string; isPrivate: boolean }) => Promise<string | null>;
  updatePlaylist: (id: string, d: { name?: string; description?: string; isPrivate?: boolean; cover?: string }) => Promise<void>;
  deletePlaylist: (id: string) => Promise<void>;
  toggleTrackLike: (id: string) => Promise<void>;
  togglePlaylistLike: (id: string) => Promise<void>;
  addToPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  removeFromPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  reorderPlaylist: (playlistId: string, trackIds: string[]) => Promise<void>;
  uploadImage: (file: File) => Promise<string>;

  follow: (userId: string, follow: boolean) => Promise<void>;
  createGroup: (name: string, description: string) => Promise<string | null>;
  joinLeaveGroup: (id: string, action: "join" | "leave") => Promise<void>;
  addGroupPost: (id: string, body: string) => Promise<void>;
  addGroupPlaylist: (id: string, playlistId: string) => Promise<void>;
  saveLyrics: (trackId: string, text: string) => Promise<void>;
}

const StoreCtx = createContext<Store | null>(null);
export function useStore(): Store {
  const s = useContext(StoreCtx);
  if (!s) throw new Error("StoreProvider missing");
  return s;
}

let toastId = 1;

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [user, setUser] = useState<UserLite | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [myPlaylists, setMyPlaylists] = useState<Playlist[]>([]);
  const [publicPlaylists, setPublicPlaylists] = useState<Playlist[]>([]);
  const [groups, setGroups] = useState<GroupLite[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [badges, setBadges] = useState<ProfileBadge[]>([]);
  const [view, setView] = useState<View>({ name: "home" });
  const [modal, setModal] = useState<ModalState | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const refreshVersion = useRef(0);

  const toast = useCallback((msg: string, kind: "ok" | "err" = "ok") => {
    const id = toastId++;
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);

  const refresh = useCallback(async () => {
    const version = ++refreshVersion.current;
    try {
      // Validate the session before requesting account-specific collections.
      const me = await api<{ user: UserLite | null; settings: AppSettings | null; token?: string }>("/api/auth");
      if (version !== refreshVersion.current) return;
      saveToken(me.user ? me.token : null);
      setUser(me.user);
      setSettings(me.settings ?? DEFAULT_SETTINGS);
      if (!me.user) { setMyPlaylists([]); setStats(null); }
      const [tr, mine, pub, gr] = await Promise.all([
        api<{ tracks: Track[] }>("/api/tracks"),
        api<{ playlists: Playlist[] }>("/api/playlists?scope=mine"),
        api<{ playlists: Playlist[] }>("/api/playlists?scope=public"),
        api<{ groups: GroupLite[] }>("/api/groups"),
      ]);
      if (version !== refreshVersion.current) return;
      setTracks(tr.tracks); setMyPlaylists(mine.playlists); setPublicPlaylists(pub.playlists); setGroups(gr.groups);
      if (me.user) {
        const badgeResponse = await api<{ mine: ProfileBadge[] }>("/api/badges");
        if (version !== refreshVersion.current) return;
        setBadges(badgeResponse.mine ?? []);
      } else setBadges([]);
      setOnline(true); setLastSync(new Date());
      // Do not cache a user's identity or private lists. Deleted accounts cannot reappear from cache.
      try {
        localStorage.removeItem("koc_cache");
        localStorage.setItem(CACHE_KEY, JSON.stringify({ tracks: tr.tracks, pub: pub.playlists }));
      } catch { /* storage unavailable */ }
    } catch (e) {
      if (version !== refreshVersion.current) return;
      setOnline(false);
      console.warn("[refresh]", (e as Error).message);
    } finally {
      if (version === refreshVersion.current) setLoading(false);
    }
  }, [toast]);

  const refreshBadges = useCallback(async () => {
    try {
      const response = await api<{ mine: ProfileBadge[] }>("/api/badges");
      setBadges(response.mine ?? []);
    } catch { /* badges are cosmetic, never block the app */ }
  }, []);

  const refreshStats = useCallback(async () => {
    try {
      const r = await api<{ stats: StatsData }>("/api/stats");
      setStats(r.stats);
    } catch {
      /* ignore – statystyki są opcjonalne */
    }
  }, []);

  useEffect(() => {
    refresh();
    // deep-linki: ?p=plista &u=user
    try {
      const q = new URLSearchParams(window.location.search);
      const p = q.get("p");
      const u = q.get("u");
      if (p) setTimeout(() => setView({ name: "playlist", id: p }), 60);
      else if (u) setTimeout(() => setView({ name: "profile", username: u }), 60);
    } catch {
      /* ignore */
    }
    // automatyczna synchronizacja
    const iv = setInterval(() => {
      if (settingsRef.current.autoSync && userRef.current) refresh();
    }, 60000);
    return () => clearInterval(iv);
  }, [refresh]);

  useEffect(() => {
    const sync = () => { void refresh(); };
    const storage = (event: StorageEvent) => {
      if (event.key === TOKEN_KEY) { memoryToken = null; void refresh(); }
    };
    window.addEventListener("online", sync);
    window.addEventListener("focus", sync);
    window.addEventListener("storage", storage);
    return () => { window.removeEventListener("online", sync); window.removeEventListener("focus", sync); window.removeEventListener("storage", storage); };
  }, [refresh]);

  const userRef = useRef(user);
  userRef.current = user;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // motyw i animacje
  useEffect(() => {
    const a = ACCENTS[settings.accent] ?? ACCENTS.szkic;
    const r = document.documentElement.style;
    r.setProperty("--accent", a.accent);
    r.setProperty("--accent2", a.accent2);
    r.setProperty("--on-accent", a.on);
    document.documentElement.setAttribute("data-anim", settings.animations);
  }, [settings]);

  const findPlaylist = useCallback(
    (id: string) => myPlaylists.find((p) => p.id === id) ?? publicPlaylists.find((p) => p.id === id),
    [myPlaylists, publicPlaylists]
  );
  const findTrack = useCallback((id: string) => tracks.find((t) => t.id === id), [tracks]);
  const likedTracks = useMemo(() => tracks.filter((t) => t.liked), [tracks]);

  /* ---------- auth ---------- */

  const login = useCallback(
    async (username: string, password: string) => {
      try {
        const r = await api<{ token: string; user: UserLite }>("/api/auth", { method: "POST", body: JSON.stringify({ action: "login", username, password }) });
        saveToken(r.token);
        setUser(r.user);
        await refresh();
        toast("Witaj z powrotem w Koczowisku");
        return null;
      } catch (e) {
        return (e as Error).message;
      }
    },
    [refresh, toast]
  );

  const register = useCallback(
    async (f: { username: string; email: string; password: string; displayName: string }) => {
      try {
        const r = await api<{ token: string; user: UserLite }>("/api/auth", { method: "POST", body: JSON.stringify({ action: "register", ...f }) });
        saveToken(r.token);
        setUser(r.user);
        await refresh();
        toast("Konto gotowe. Twoja biblioteka jest zsynchronizowana.");
        return null;
      } catch (e) {
        return (e as Error).message;
      }
    },
    [refresh, toast]
  );

  const logout = useCallback(async () => {
    try {
      await api("/api/presence", { method: "DELETE" }).catch(() => {});
      await api("/api/auth", { method: "POST", body: JSON.stringify({ action: "logout" }) });
    } catch {
      toast("Brak połączenia. Nie można potwierdzić wylogowania — spróbuj ponownie po odzyskaniu sieci.", "err");
      return;
    }
    ++refreshVersion.current; // Ignore in-flight requests from the previous account.
    saveToken(null);
    setUser(null); setStats(null); setMyPlaylists([]); setBadges([]); setTracks([]); setPublicPlaylists([]); setGroups([]);
    setSettings(DEFAULT_SETTINGS); setModal(null);
    try { localStorage.removeItem(CACHE_KEY); localStorage.removeItem("koc_cache"); } catch { /* ignore */ }
    setView({ name: "home" });
    await refresh();
    toast("Wylogowano.");
  }, [refresh, toast]);

  const updateProfile = useCallback(
    async (displayName: string, bio: string) => {
      try {
        await api("/api/auth", { method: "POST", body: JSON.stringify({ action: "update", displayName, bio }) });
        await refresh();
        toast("Profil zaktualizowany");
      } catch (e) {
        toast((e as Error).message, "err");
      }
    },
    [refresh, toast]
  );

  const uploadAvatar = useCallback(
    async (file: File) => {
      const fd = new FormData();
      fd.append("avatar", file);
      try {
        await api("/api/auth", { method: "POST", body: fd });
        await refresh();
        toast("Nowy awatar zapisany");
      } catch (e) {
        toast((e as Error).message, "err");
      }
    },
    [refresh, toast]
  );

  const deleteAccount = useCallback(
    async (password: string) => {
      try {
        await api("/api/auth", { method: "POST", body: JSON.stringify({ action: "delete", password }) });
        ++refreshVersion.current;
        saveToken(null);
        setUser(null); setStats(null); setMyPlaylists([]);
        try {
          localStorage.removeItem(CACHE_KEY);
          localStorage.removeItem("koc_cache");
        } catch {
          /* ignore */
        }
        setModal(null);
        await refresh();
        setView({ name: "home" });
        toast("Konto zostało trwale usunięte.");
      } catch (e) {
        toast((e as Error).message, "err");
      }
    },
    [refresh, toast]
  );

  const saveSettings = useCallback(
    async (patch: Partial<AppSettings>) => {
      const next = { ...settings, ...patch };
      setSettings(next); // optymistycznie
      if (!user) return; // bez konta ustawienia trzymane lokalnie
      try {
        await api("/api/settings", { method: "PUT", body: JSON.stringify(patch) });
      } catch {
        toast("Nie udało się zsynchronizować ustawień", "err");
      }
    },
    [settings, user, toast]
  );

  /* ---------- biblioteka ---------- */

  const uploadTracks = useCallback(
    async (files: { file: File; meta: { title: string; artist: string; album: string; duration: number } }[]) => {
      let added = 0;
      for (const f of files) {
        const fd = new FormData();
        fd.append("audio", f.file);
        fd.append("title", f.meta.title);
        fd.append("artist", f.meta.artist);
        fd.append("album", f.meta.album);
        fd.append("duration", String(f.meta.duration));
        if (f.file.type.startsWith("image/")) fd.append("cover", f.file);
        try {
          await api("/api/tracks", { method: "POST", body: fd });
          added++;
        } catch (e) {
          toast(`${f.file.name}: ${(e as Error).message}`, "err");
        }
      }
      if (added > 0) {
        toast(`${added} ${added === 1 ? "utwór dodany" : "utwory dodane"} do biblioteki`);
        await refresh();
      }
      return added;
    },
    [refresh, toast]
  );

  const deleteTrack = useCallback(
    async (id: string) => {
      try {
        await api(`/api/tracks/${id}`, { method: "DELETE" });
        toast("Utwór usunięty z biblioteki");
        await refresh();
      } catch (e) {
        toast((e as Error).message, "err");
      }
    },
    [refresh, toast]
  );

  const uploadImage = useCallback(async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const r = await api<{ url: string }>("/api/upload-image", { method: "POST", body: fd });
    return r.url;
  }, []);

  /* ---------- playlisty ---------- */

  const createPlaylist = useCallback(
    async (d: { name: string; description: string; isPrivate: boolean }) => {
      try {
        const r = await api<{ playlist: Playlist }>("/api/playlists", { method: "POST", body: JSON.stringify(d) });
        await refresh();
        return r.playlist.id;
      } catch (e) {
        toast((e as Error).message, "err");
        return null;
      }
    },
    [refresh, toast]
  );

  const updatePlaylist = useCallback(
    async (id: string, d: { name?: string; description?: string; isPrivate?: boolean; cover?: string }) => {
      try {
        await api(`/api/playlists/${id}`, { method: "PATCH", body: JSON.stringify(d) });
        await refresh();
        toast("Playlista zaktualizowana");
      } catch (e) {
        toast((e as Error).message, "err");
      }
    },
    [refresh, toast]
  );

  const deletePlaylist = useCallback(
    async (id: string) => {
      try {
        await api(`/api/playlists/${id}`, { method: "DELETE" });
        toast("Playlista usunięta");
        setView({ name: "library" });
        await refresh();
      } catch (e) {
        toast((e as Error).message, "err");
      }
    },
    [refresh, toast]
  );

  const toggleTrackLike = useCallback(
    async (id: string) => {
      if (!userRef.current) {
        setModal({ type: "auth" });
        return;
      }
      try {
        await api("/api/likes", { method: "POST", body: JSON.stringify({ kind: "track", id }) });
        await refresh();
      } catch (e) {
        toast((e as Error).message, "err");
      }
    },
    [refresh, toast]
  );

  const togglePlaylistLike = useCallback(
    async (id: string) => {
      if (!userRef.current) {
        setModal({ type: "auth" });
        return;
      }
      try {
        await api("/api/likes", { method: "POST", body: JSON.stringify({ kind: "playlist", id }) });
        await refresh();
      } catch (e) {
        toast((e as Error).message, "err");
      }
    },
    [refresh, toast]
  );

  const addToPlaylist = useCallback(
    async (playlistId: string, trackId: string) => {
      try {
        await api(`/api/playlists/${playlistId}/tracks`, {
          method: "POST",
          body: JSON.stringify({ trackId }),
        });
        toast("Dodano do playlisty");
        await refresh();
      } catch (e) {
        const err = e as Error & { status?: number };
        if (!String(err.message).includes("już")) toast(err.message, "err");
      }
    },
    [refresh, toast]
  );

  const removeFromPlaylist = useCallback(
    async (playlistId: string, trackId: string) => {
      try {
        await api(`/api/playlists/${playlistId}/tracks`, {
          method: "DELETE",
          body: JSON.stringify({ trackId }),
        });
        toast("Usunięto z playlisty");
        await refresh();
      } catch (e) {
        toast((e as Error).message, "err");
      }
    },
    [refresh, toast]
  );

  const reorderPlaylist = useCallback(
    async (playlistId: string, trackIds: string[]) => {
      try {
        await api(`/api/playlists/${playlistId}/tracks`, {
          method: "PUT",
          body: JSON.stringify({ trackIds }),
        });
        toast("Kolejność zapisana");
        await refresh();
      } catch (e) {
        toast((e as Error).message, "err");
      }
    },
    [refresh, toast]
  );

  /* ---------- społeczność ---------- */

  const follow = useCallback(
    async (userId: string, follow: boolean) => {
      try {
        // toggle: wywołanie API odwraca stan – przesyłamy tylko gdy celowo
        await api("/api/follows", { method: "POST", body: JSON.stringify({ userId, toggle: follow }) });
        toast(follow ? "Obserwujesz ten profil" : "Przestałeś obserwować");
        await refresh();
      } catch (e) {
        toast((e as Error).message, "err");
      }
    },
    [refresh, toast]
  );

  const createGroup = useCallback(
    async (name: string, description: string) => {
      try {
        const r = await api<{ group: GroupLite }>("/api/groups", {
          method: "POST",
          body: JSON.stringify({ name, description }),
        });
        toast("Grupa założona");
        await refresh();
        return r.group?.id ?? null;
      } catch (e) {
        toast((e as Error).message, "err");
        return null;
      }
    },
    [refresh, toast]
  );

  const joinLeaveGroup = useCallback(
    async (id: string, action: "join" | "leave") => {
      try {
        await api(`/api/groups/${id}`, { method: "POST", body: JSON.stringify({ action }) });
        toast(action === "join" ? "Dołączyłeś do grupy" : "Opuściłeś grupę");
        await refresh();
      } catch (e) {
        toast((e as Error).message, "err");
      }
    },
    [refresh, toast]
  );

  const addGroupPost = useCallback(
    async (id: string, body: string) => {
      try {
        await api(`/api/groups/${id}/posts`, { method: "POST", body: JSON.stringify({ body }) });
        toast("Post dodany");
      } catch (e) {
        toast((e as Error).message, "err");
      }
    },
    [toast]
  );

  const addGroupPlaylist = useCallback(
    async (id: string, playlistId: string) => {
      try {
        await api(`/api/groups/${id}/playlists`, { method: "POST", body: JSON.stringify({ playlistId }) });
        toast("Playlista udostępniona w grupie");
      } catch (e) {
        toast((e as Error).message, "err");
      }
    },
    [toast]
  );

  const saveLyrics = useCallback(
    async (trackId: string, text: string) => {
      try {
        await api("/api/lyrics", { method: "POST", body: JSON.stringify({ trackId, lines: text }) });
        toast("Tekst zapisany");
        await refresh();
      } catch (e) {
        toast((e as Error).message, "err");
      }
    },
    [refresh, toast]
  );

  const value: Store = {
    loading,
    online,
    lastSync,
    user,
    settings,
    tracks,
    myPlaylists,
    publicPlaylists,
    groups,
    stats,
    view,
    setView,
    modal,
    openModal: setModal,
    closeModal: () => setModal(null),
    toasts,
    toast,
    refresh,
    refreshStats,
    findPlaylist,
    findTrack,
    likedTracks,
    badges,
    refreshBadges,
    login,
    register,
    logout,
    updateProfile,
    uploadAvatar,
    deleteAccount,
    saveSettings,
    uploadTracks,
    deleteTrack,
    createPlaylist,
    updatePlaylist,
    deletePlaylist,
    toggleTrackLike,
    togglePlaylistLike,
    addToPlaylist,
    removeFromPlaylist,
    reorderPlaylist,
    uploadImage,
    follow,
    createGroup,
    joinLeaveGroup,
    addGroupPost,
    addGroupPlaylist,
    saveLyrics,
  };

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

/* ================= Player ================= */

export type RepeatMode = "off" | "all" | "one";

interface PlayerApi {
  current: Track | null;
  playing: boolean;
  position: number;
  duration: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  queue: Track[];
  history: Track[];
  label: string;
  play: (tracks: Track[], start?: number, label?: string) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (t: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  removeFromQueue: (i: number) => void;
  clearQueue: () => void;
  queueTrack: (t: Track) => void;
  jumpTo: (i: number) => void;
  isCurrent: (t: Track) => boolean;
}

const PlayerCtx = createContext<PlayerApi | null>(null);
export function usePlayer(): PlayerApi {
  const s = useContext(PlayerCtx);
  if (!s) throw new Error("PlayerProvider missing");
  return s;
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const store = useStore();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [current, setCurrent] = useState<Track | null>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.85);
  const [muted, setMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>("off");
  const [queue, setQueue] = useState<Track[]>([]);
  const [history, setHistory] = useState<Track[]>([]);
  const [label, setLabel] = useState("");

  const contextRef = useRef<Track[]>([]);
  const startedAtRef = useRef<number | null>(null);
  const accRef = useRef(0);
  const lastPosRef = useRef(0);
  const lastTRef = useRef(-1);
  const pendingStartRef = useRef(0);
  const stateRef = useRef({ current, queue, shuffle, repeat });
  stateRef.current = { current, queue, shuffle, repeat };
  const userRef = useRef(store.user);
  userRef.current = store.user;
  const settingsRef = useRef(store.settings);
  settingsRef.current = store.settings;

  const saveResume = useCallback((t: Track | null) => {
    if (!t) return;
    try {
      const map: Record<string, number> = JSON.parse(localStorage.getItem("koc_resume") || "{}");
      map[t.id] = lastPosRef.current;
      localStorage.setItem("koc_resume", JSON.stringify(map));
    } catch {
      /* ignore */
    }
  }, []);

  const flushListen = useCallback(() => {
    const { current } = stateRef.current;
    const sec = Math.round(accRef.current);
    if (current && userRef.current && sec >= 3 && startedAtRef.current) {
      api("/api/stats/listen", {
        method: "POST",
        body: JSON.stringify({
          trackId: current.id,
          seconds: sec,
          startedAt: new Date(startedAtRef.current).toISOString(),
        }),
      }).catch(() => {});
    }
    accRef.current = 0;
  }, []);

  const ensureAudio = useCallback((): HTMLAudioElement => {
    if (!audioRef.current) {
      const a = new Audio();
      a.preload = "metadata";
      audioRef.current = a;
      a.addEventListener("timeupdate", () => {
        lastPosRef.current = a.currentTime;
        setPosition(a.currentTime);
        if (!a.paused) accRef.current += 0.25 * 4; // timeupdate ~4x/s
      });
      a.addEventListener("loadedmetadata", () => setDuration(a.duration || 0));
      a.addEventListener("play", () => setPlaying(true));
      a.addEventListener("pause", () => {
        setPlaying(false);
        saveResume(stateRef.current.current);
      });
      a.addEventListener("ended", () => {
        saveResume(stateRef.current.current);
        onEndedRef.current();
      });
    }
    return audioRef.current;
  }, [saveResume]);

  const startTrack = useCallback(
    (t: Track, autoplay = true) => {
      const a = ensureAudio();
      flushListen();
      startedAtRef.current = Date.now();
      accRef.current = 0;
      lastPosRef.current = 0;
      lastTRef.current = -1;
      setCurrent(t);
      setPosition(0);
      setDuration(t.duration || 0);
      a.src = trackUrl(t);
      a.load();
      setHistory((h) => [t, ...h.filter((x) => x.id !== t.id)].slice(0, 50));
      if (autoplay) {
        let start = 0;
        if (settingsRef.current.resumePosition && t.duration > 10) {
          try {
            const map: Record<string, number> = JSON.parse(localStorage.getItem("koc_resume") || "{}");
            start = map[t.id] && map[t.id] < t.duration - 6 ? map[t.id] : 0;
          } catch {
            /* ignore */
          }
        }
        pendingStartRef.current = start;
        lastPosRef.current = start;
        a.play().catch(() => {});
      }
    },
    [ensureAudio, flushListen]
  );

  const nextRef = useRef<() => void>(() => {});
  const next = useCallback(() => {
    const { queue, shuffle, repeat } = stateRef.current;
    if (repeat === "one" && stateRef.current.current) {
      startTrack(stateRef.current.current, true);
      return;
    }
    if (queue.length > 0) {
      const idx = shuffle ? Math.floor(Math.random() * queue.length) : 0;
      const t = queue[idx];
      setQueue((q) => q.filter((_, i) => i !== idx));
      startTrack(t, true);
      return;
    }
    const ctx = contextRef.current;
    if (repeat === "all" && ctx.length > 1) {
      const rest = ctx.filter((t) => t.id !== stateRef.current.current?.id);
      setQueue([...rest]);
      nextRef.current();
      return;
    }
    // koniec kolejki – zatrzymaj
    const a = audioRef.current;
    if (a) a.pause();
  }, [startTrack]);
  nextRef.current = next;

  const onEndedRef = useRef<() => void>(() => {});
  onEndedRef.current = () => {
    const { repeat } = stateRef.current;
    if (repeat === "one" && stateRef.current.current) {
      const a = audioRef.current;
      if (a) {
        a.currentTime = 0;
        a.play().catch(() => {});
      }
      return;
    }
    if (!settingsRef.current.autoplayNext) return;
    nextRef.current();
  };

  const play = useCallback(
    (tracks: Track[], start = 0, labelArg?: string) => {
      if (!tracks.length) return;
      contextRef.current = tracks;
      const t = tracks[start] ?? tracks[0];
      const rest = [...tracks.slice(0, start), ...tracks.slice(start + 1)];
      setQueue(shuffle ? [...rest].sort(() => Math.random() - 0.5) : rest);
      if (labelArg !== undefined) setLabel(labelArg);
      startTrack(t, true);
    },
    [startTrack, shuffle]
  );

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!current) return;
    if (!a) {
      // przywróć element
      startTrack(current, true);
      return;
    }
    if (a.paused) {
      a.play().catch(() => {});
    } else {
      a.pause();
    }
  }, [current, startTrack]);

  const prev = useCallback(() => {
    const a = audioRef.current;
    if (a && lastPosRef.current > 3) {
      a.currentTime = 0;
      setPosition(0);
      return;
    }
    const { history: hist } = { history };
    if (hist.length > 0) startTrack(hist[0], true);
    else if (a) {
      a.currentTime = 0;
      setPosition(0);
    }
  }, [history, startTrack]);

  const seek = useCallback(
    (t: number) => {
      const a = audioRef.current;
      if (!a) return;
      a.currentTime = t;
      setPosition(t);
      lastPosRef.current = t;
    },
    []
  );

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    if (audioRef.current) audioRef.current.volume = v;
    if (v > 0) setMuted(false);
    try {
      localStorage.setItem("koc_vol", String(v));
    } catch {
      /* ignore */
    }
  }, []);

  const toggleMute = useCallback(() => setMuted((m) => !m), []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = muted ? 0 : volume;
  }, [volume, muted]);

  useEffect(() => {
    try {
      const v = localStorage.getItem("koc_vol");
      if (v) {
        setVolumeState(Number(v));
        if (audioRef.current) audioRef.current.volume = Number(v);
      }
    } catch {
      /* ignore */
    }
    // czyszczenie po zamknięciu
    return () => {
      flushListen();
    };
  }, [flushListen]);

  // Udostępnianie statusu „Słucha teraz” zalogowanym użytkownikom.
  useEffect(() => {
    if (!store.user || !current || !playing) {
      if (store.user) api("/api/presence", { method: "DELETE" }).catch(() => {});
      return;
    }
    const publish = () => api("/api/presence", {
      method: "POST",
      body: JSON.stringify({ trackId: current.id }),
    }).catch(() => {});
    publish();
    const iv = setInterval(publish, 30_000);
    return () => clearInterval(iv);
  }, [store.user?.id, current?.id, playing]);

  useEffect(() => {
    return () => {
      if (userRef.current) api("/api/presence", { method: "DELETE" }).catch(() => {});
    };
  }, []);

  // okresowe zapisywanie nasłuchu
  useEffect(() => {
    const iv = setInterval(() => {
      if (playing) flushListen();
    }, 20000);
    return () => clearInterval(iv);
  }, [playing, flushListen]);

  // klawiatura: spacja = play/pauza
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.code === "Space") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [toggle]);

  const apiObj: PlayerApi = {
    current,
    playing,
    position,
    duration,
    volume,
    muted,
    shuffle,
    repeat,
    queue,
    history,
    label,
    play,
    toggle,
    next,
    prev,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle: () => setShuffle((s) => !s),
    cycleRepeat: () => setRepeat((r) => (r === "off" ? "all" : r === "all" ? "one" : "off")),
    removeFromQueue: (i) => setQueue((q) => q.filter((_, idx) => idx !== i)),
    clearQueue: () => setQueue([]),
    queueTrack: (t) => setQueue((q) => [...q, t]),
    jumpTo: (i) => {
      const t = queue[i];
      if (!t) return;
      setQueue((q) => q.filter((_, idx) => idx !== i));
      startTrack(t, true);
    },
    isCurrent: (t: Track) => current?.id === t.id,
  };

  return <PlayerCtx.Provider value={apiObj}>{children}</PlayerCtx.Provider>;
}
