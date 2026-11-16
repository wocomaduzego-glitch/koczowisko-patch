export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  path: string;
  cover: string | null;
  addedBy: string | null;
  addedByName: string | null;
  isDemo: boolean;
  likes: number;
  liked: boolean;
  hasLyrics: boolean;
  commentCount: number;
  createdAt: string;
}

export interface Playlist {
  id: string;
  ownerId: string;
  ownerName: string;
  name: string;
  description: string;
  cover: string | null;
  isPrivate: boolean;
  kind: "normal";
  tracks: Track[];
  totalDuration: number;
  likes: number;
  liked: boolean;
  isOwner: boolean;
  createdAt: string;
}

export interface UserLite {
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
  bio: string;
  isSystem: boolean;
  badges?: ProfileBadge[];
}

export interface CommentItem {
  id: string;
  body: string;
  createdAt: string;
  user: UserLite;
  replies: CommentItem[];
}

export interface GroupLite {
  id: string;
  name: string;
  description: string;
  ownerName: string;
  memberCount: number;
  postCount: number;
  isMember: boolean;
}

export interface GroupDetail extends GroupLite {
  members: { user: UserLite; role: string }[];
  posts: {
    id: string;
    body: string;
    createdAt: string;
    user: UserLite;
  }[];
  playlists: Playlist[];
}

export interface LyricsDoc {
  trackId: string;
  synced: boolean;
  authorName: string | null;
  lines: { t?: number; x: string }[];
}

export interface StatsData {
  totalSeconds: number;
  totalPlays: number;
  uniqueTracks: number;
  activeDays: number;
  topTracks: { track: Track; seconds: number; plays: number }[];
  topArtists: { artist: string; seconds: number }[];
  topPlaylists: { playlist: Playlist; likes: number }[];
  daily: { date: string; seconds: number }[];
  activity: { track: Track; at: string; seconds: number }[];
}

export interface ProfileBadge {
  badge: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface BadgeDefinition {
  key: string;
  name: string;
  hint: string;
}

export interface AppSettings {
  accent: string;
  animations: "full" | "reduced" | "off";
  autoplayNext: boolean;
  resumePosition: boolean;
  autoSync: boolean;
  social: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  accent: "szkic",
  animations: "full",
  autoplayNext: true,
  resumePosition: true,
  autoSync: true,
  social: true,
};

export const ACCENTS: Record<string, { label: string; accent: string; accent2: string; on: string }> = {
  szkic: { label: "Grafit", accent: "#373a40", accent2: "#535962", on: "#ffffff" },
  szmaragd: { label: "Stal", accent: "#445760", accent2: "#647783", on: "#ffffff" },
  rzeka: { label: "Ołówek", accent: "#4b565d", accent2: "#68747b", on: "#ffffff" },
  widmo: { label: "Atrament", accent: "#54505c", accent2: "#716c7a", on: "#ffffff" },
  zloto: { label: "Sepia", accent: "#645b50", accent2: "#7a7063", on: "#ffffff" },
};

export type View =
  | { name: "home" }
  | { name: "search"; initial?: string }
  | { name: "library" }
  | { name: "groups" }
  | { name: "stats" }
  | { name: "lyrics" }
  | { name: "settings" }
  | { name: "playlist"; id: string }
  | { name: "profile"; username: string }
  | { name: "group"; id: string }\n  | { name: "friends" }\n  | { name: "admin" };

export function fmtTime(sec: number): string {
  if (!sec || sec < 0 || !isFinite(sec)) return "0:00";
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export function fmtLong(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  if (h === 0) return `${m} min`;
  return `${h} godz. ${m} min`;
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "przed chwilą";
  if (min < 60) return `${min} min temu`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} godz. temu`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} dni temu`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo} mies. temu`;
  return `${Math.floor(mo / 12)} lat temu`;
}

export function trackUrl(t: Track): string {
  return `/api/stream/${t.id}`;
}

/** Stabilny hash liczbowy z nazwy (do awatarów z inicjałami). */
export function nameHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
