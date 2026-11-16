"use client";
import React, { useEffect, useId, useRef, useState } from "react";
import { api, usePlayer, useStore } from "./ctx";
import type { Playlist, ProfileBadge, Track, UserLite } from "@/lib/types";
import { fmtTime, nameHash } from "@/lib/types";

/* ================= Ikony (własne, kreskowe) ================= */

export function Svg({
  size = 18,
  className,
  filled,
  children,
}: {
  size?: number;
  className?: string;
  filled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 0.5 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export const I = {
  home: (p?: { size?: number; className?: string }) => (
    <Svg {...p}><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 9.5V20h13V9.5" /><path d="M10 20v-5h4v5" /></Svg>
  ),
  search: (p?: { size?: number; className?: string }) => (
    <Svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></Svg>
  ),
  library: (p?: { size?: number; className?: string }) => (
    <Svg {...p}><path d="M4 5v14" /><path d="M9 5v14" /><path d="m13.5 5.8 4.6 12.7" /><path d="M4 17.5h5.5" /></Svg>
  ),
  users: (p?: { size?: number; className?: string }) => (
    <Svg {...p}><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19.5c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5" /><circle cx="16.5" cy="9.5" r="2.4" /><path d="M16 15.1c2.3.2 4 1.5 4.5 3.9" /></Svg>
  ),
  chart: (p?: { size?: number; className?: string }) => (
    <Svg {...p}><path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-8" /><path d="M21 20H3" /></Svg>
  ),
  book: (p?: { size?: number; className?: string }) => (
    <Svg {...p}><path d="M12 6c-1.5-1.7-4-2.5-7-2.5v14c3 0 5.5.8 7 2.5 1.5-1.7 4-2.5 7-2.5v-14c-3 0-5.5.8-7 2.5Z" /><path d="M12 6v14" /></Svg>
  ),
  gear: (p?: { size?: number; className?: string }) => (
    <Svg {...p}><circle cx="12" cy="12" r="3.2" /><path d="M12 2.8 13 5.4a6.8 6.8 0 0 1 2 .8l2.5-1.2 1.6 1.6-1.2 2.5c.4.6.7 1.3.8 2l2.6 1v2.2l-2.6 1a6.8 6.8 0 0 1-.8 2l1.2 2.5-1.6 1.6-2.5-1.2a6.8 6.8 0 0 1-2 .8L12 21.2l-1-2.6a6.8 6.8 0 0 1-2-.8l-2.5 1.2-1.6-1.6 1.2-2.5a6.8 6.8 0 0 1-.8-2L3 12.4v-2.2l2.6-1c.1-.7.4-1.4.8-2L5.2 4.7l1.6-1.6 2.5 1.2a6.8 6.8 0 0 1 2-.8l1-2.7Z" /></Svg>
  ),
  play: (p?: { size?: number; className?: string }) => (
    <Svg {...p} filled><path d="M7 4.8v14.4c0 .8.9 1.3 1.6.9l11-7.2c.6-.4.6-1.4 0-1.8l-11-7.2c-.7-.4-1.6.1-1.6.9Z" /></Svg>
  ),
  pause: (p?: { size?: number; className?: string }) => (
    <Svg {...p} filled><rect x="6" y="4.5" width="4" height="15" rx="1.2" /><rect x="14" y="4.5" width="4" height="15" rx="1.2" /></Svg>
  ),
  next: (p?: { size?: number; className?: string }) => (
    <Svg {...p} filled><path d="M5 5.6v12.8c0 .8.9 1.3 1.6.8l8-6.4c.6-.5.6-1.4 0-1.8l-8-6.4C5.9 4.3 5 4.8 5 5.6Z" /><rect x="16.5" y="5" width="2.6" height="14" rx="1" /></Svg>
  ),
  prev: (p?: { size?: number; className?: string }) => (
    <Svg {...p} filled><path d="M19 5.6v12.8c0 .8-.9 1.3-1.6.8l-8-6.4c-.6-.5-.6-1.4 0-1.8l8-6.4c.7-.5 1.6.1 1.6.8Z" /><rect x="4.9" y="5" width="2.6" height="14" rx="1" /></Svg>
  ),
  shuffle: (p?: { size?: number; className?: string }) => (
    <Svg {...p}><path d="M3 6.5h3.5c4.5 0 6 5 10 9l4 2.5" /><path d="M3 16.5h3.5c1.6 0 2.9-.6 4-1.7M20.5 8l-3.8 4.4M16.7 12.4 20.5 8l-3.8-4.4" /></Svg>
  ),
  repeat: (p?: { size?: number; className?: string; one?: boolean }) => (
    <Svg {...p}>
      <path d="M17 3.5 20 6.5l-3 3" /><path d="M4 12V10a4 4 0 0 1 4-4h12" /><path d="M7 20.5 4 17.5l3-3" /><path d="M20 12v2a4 4 0 0 1-4 4H4" />
      {p?.one ? <text x="12" y="14.5" fontSize="7.5" textAnchor="middle" fill="currentColor" stroke="none" fontWeight="700">1</text> : null}
    </Svg>
  ),
  queue: (p?: { size?: number; className?: string }) => (
    <Svg {...p}><path d="M4 6h12" /><path d="M4 11h12" /><path d="M4 16h7" /><path d="m14 14.5 5.5 3-5.5 3v-6Z" /></Svg>
  ),
  clock: (p?: { size?: number; className?: string }) => (
    <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2" /></Svg>
  ),
  heart: (p?: { size?: number; className?: string; filled?: boolean }) => (
    <Svg {...p}><path d="M12 20.5c-5.2-3.4-8.5-6.5-8.5-10A4.6 4.6 0 0 1 8 5.8c1.6 0 3 .8 4 2.2 1-1.4 2.4-2.2 4-2.2a4.6 4.6 0 0 1 4.5 4.7c0 3.5-3.3 6.6-8.5 10Z" /></Svg>
  ),
  plus: (p?: { size?: number; className?: string }) => (
    <Svg {...p}><path d="M12 5v14" /><path d="M5 12h14" /></Svg>
  ),
  dots: (p?: { size?: number; className?: string }) => (
    <Svg {...p} filled><circle cx="12" cy="5.5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="18.5" r="1.6" /></Svg>
  ),
  trash: (p?: { size?: number; className?: string }) => (
    <Svg {...p}><path d="M4.5 6.5h15" /><path d="M9 6V4.5h6V6" /><path d="M6.5 6.5 7.5 20h9l1-13.5" /><path d="M10 10.5v6" /><path d="M14 10.5v6" /></Svg>
  ),
  edit: (p?: { size?: number; className?: string }) => (
    <Svg {...p}><path d="M14.5 5 19 9.5 8.5 20H4v-4.5L14.5 5Z" /><path d="m12.5 7 4.5 4.5" /></Svg>
  ),
  share: (p?: { size?: number; className?: string }) => (
    <Svg {...p}><circle cx="6" cy="12" r="2.6" /><circle cx="17.5" cy="5.5" r="2.6" /><circle cx="17.5" cy="18.5" r="2.6" /><path d="m8.4 10.8 6.8-4M8.4 13.2l6.8 4" /></Svg>
  ),
  x: (p?: { size?: number; className?: string }) => (
    <Svg {...p}><path d="m6 6 12 12" /><path d="M18 6 6 18" /></Svg>
  ),
  check: (p?: { size?: number; className?: string }) => (
    <Svg {...p}><path d="m4.5 12.5 5 5L19.5 7" /></Svg>
  ),
  music: (p?: { size?: number; className?: string }) => (
    <Svg {...p}><path d="M9 18.5V6l10-2.5V16" /><circle cx="6.5" cy="18.5" r="2.5" /><circle cx="16.5" cy="16" r="2.5" /></Svg>
  ),
  vol: (p?: { size?: number; className?: string; muted?: boolean }) => (
    <Svg {...p}>
      <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Z" />
      {p?.muted ? <path d="m16 9.5 5 5m0-5-5 5" /> : <path d="M15.5 9.5a4 4 0 0 1 0 5M18 7.5a7 7 0 0 1 0 9" />}
    </Svg>
  ),
  logout: (p?: { size?: number; className?: string }) => (
    <Svg {...p}><path d="M14 4.5H6.5v15H14" /><path d="m10 12 6.5-6.5M16.5 12l6.5 6.5M16.5 12H4" transform="translate(-3.5 -2)" /><path d="M11 12h9" /></Svg>
  ),
  user: (p?: { size?: number; className?: string }) => (
    <Svg {...p}><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20c.9-3.6 3.8-5.5 7.5-5.5s6.6 1.9 7.5 5.5" /></Svg>
  ),
  medal: (p?: { size?: number; className?: string }) => (
    <Svg {...p}><circle cx="12" cy="14.5" r="5" /><path d="m8.5 10 2-6M15.5 10l-2-6" /><path d="m10.5 14.5 1 1 2-2" /></Svg>
  ),
  back: (p?: { size?: number; className?: string }) => (
    <Svg {...p}><path d="M14.5 5.5 8 12l6.5 6.5" /></Svg>
  ),
  grip: (p?: { size?: number; className?: string }) => (
    <Svg {...p} filled><circle cx="9" cy="6" r="1.4" /><circle cx="15" cy="6" r="1.4" /><circle cx="9" cy="12" r="1.4" /><circle cx="15" cy="12" r="1.4" /><circle cx="9" cy="18" r="1.4" /><circle cx="15" cy="18" r="1.4" /></Svg>
  ),
  expand: (p?: { size?: number; className?: string }) => (
    <Svg {...p}><path d="M9 4.5H4.5V9" /><path d="M15 4.5h4.5V9" /><path d="M9 19.5H4.5V15" /><path d="M15 19.5h4.5V15" /></Svg>
  ),
  upload: (p?: { size?: number; className?: string }) => (
    <Svg {...p}><path d="M12 15.5v-11" /><path d="m7.5 9 4.5-4.5L16.5 9" /><path d="M4.5 15.5v4h15v-4" /></Svg>
  ),
  eye: (p?: { size?: number; className?: string; off?: boolean }) => (
    <Svg {...p}>
      <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.8" />
      {p?.off ? <path d="M4 20 20 4" /> : null}
    </Svg>
  ),
};

/* ================= Branding KOCZ ================= */

/** Pole „wgraj swój obrazek” – widoczne tylko dopóki żaden obrazek nie został wgrany. Plik trafia na serwer bez zmian. */
function BrandUploadSlot({ className }: { className: string }) {
  const store = useStore();
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const send = async (file?: File | null) => {
    if (!file) return;
    const form = new FormData();
    form.append("image", file);
    setBusy(true);
    try {
      await api("/api/brand", { method: "POST", body: form });
      window.dispatchEvent(new Event("kocz-brand-updated"));
      store.toast("Obrazek zapisany bez żadnych zmian");
    } catch (e) {
      store.toast((e as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };
  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); void send(e.dataTransfer.files?.[0]); }}
      className={`flex flex-col items-center justify-center gap-2 text-center cursor-pointer rounded-lg border-2 border-dashed px-4 text-[var(--muted)] transition-colors hover:border-[var(--accent)] ${over ? "border-[var(--accent)] bg-[var(--hover)]" : "border-[var(--line2)] bg-[#f8f8f6]"} ${className}`}
    >
      {I.upload({ size: 26 })}
      <span className="text-sm font-semibold text-[var(--text)]">{busy ? "Zapisywanie…" : "Wgraj swój obrazek KOCZ"}</span>
      <span className="text-xs">Kliknij lub upuść tutaj plik PNG, JPG albo WebP. Zapiszemy go bez żadnych zmian.</span>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        disabled={busy}
        onChange={(e) => { void send(e.target.files?.[0]); e.target.value = ""; }}
      />
    </label>
  );
}

export function KoczMark({ className = "", alt = "KOCZ", uploadable = false }: { className?: string; alt?: string; uploadable?: boolean }) {
  const [version, setVersion] = useState(0);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    const refresh = () => { setMissing(false); setVersion(Date.now()); };
    window.addEventListener("kocz-brand-updated", refresh);
    return () => window.removeEventListener("kocz-brand-updated", refresh);
  }, []);
  if (missing && uploadable) return <BrandUploadSlot className={className} />;
  if (missing) {
    return <span role="img" aria-label={alt || "KOCZ"} className={`inline-flex items-center justify-center border border-[var(--line2)] bg-[#f4f3ef] text-[#3a3a3a] font-display font-black tracking-[-0.08em] ${className}`}>KOCZ</span>;
  }
  return <img src={`/api/brand?v=${version}`} alt={alt} className={className} onError={() => setMissing(true)} draggable={false} />;
}

/** Delikatne, odręczne kreski w tle – motyw zeszytu zamiast dotychczasowej grafiki. */
export function SketchField() {
  return <div className="absolute inset-0 pointer-events-none opacity-50" aria-hidden style={{ backgroundImage: "repeating-linear-gradient(to bottom, transparent 0, transparent 35px, rgba(150, 157, 164, .10) 36px, transparent 37px)" }} />;
}

/* ================= Podstawowe elementy ================= */

const AV_COLORS = ["#555b61", "#646b70", "#525c64", "#74747a", "#62615d", "#5a6266"];

export function Avatar({ user, size = 36, className = "" }: { user: Pick<UserLite, "displayName" | "avatar">; size?: number; className?: string }) {
  if (user.avatar) {
    return <img src={user.avatar} alt={user.displayName} width={size} height={size} className={`rounded-full object-cover shrink-0 ${className}`} />;
  }
  const h = nameHash(user.displayName || "?");
  const c = AV_COLORS[h % AV_COLORS.length];
  const initials = (user.displayName || "?")
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      className={`rounded-full shrink-0 flex items-center justify-center font-display font-bold text-white/90 ${className}`}
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${c}, ${c}88)`, fontSize: size * 0.38 }}
    >
      {initials}
    </div>
  );
}

export function Cover({
  src,
  alt,
  className = "",
  iconSize = 26,
}: {
  src: string | null;
  alt: string;
  className?: string;
  iconSize?: number;
}) {
  const [broken, setBroken] = useState(false);
  const [version, setVersion] = useState(0);
  useEffect(() => { setBroken(false); }, [src]);
  useEffect(() => {
    const refresh = () => { setBroken(false); setVersion(Date.now()); };
    window.addEventListener("kocz-brand-updated", refresh);
    return () => window.removeEventListener("kocz-brand-updated", refresh);
  }, []);
  if (src && !broken) {
    return <img src={src === "/api/brand" ? `${src}?v=${version}` : src} alt={alt} className={`${src === "/api/brand" ? "object-contain bg-white" : "object-cover"} ${className}`} loading="lazy" onError={() => setBroken(true)} />;
  }
  return (
    <div className={`flex items-center justify-center text-[#666] ${className}`} style={{ background: "linear-gradient(135deg, #eeede9, #d8d8d5)" }}>
      {I.music({ size: iconSize })}
    </div>
  );
}

/** Mała etykieta odznaki na profilu. */
export function BadgeChip({ badge, large }: { badge: ProfileBadge; large?: boolean }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full border border-[var(--line2)] bg-[var(--panel)] ${large ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[11px]"} font-semibold text-[var(--text)]`} title={`Odznaka: ${badge.name}`}><span aria-hidden className={`${large ? "w-3 h-3" : "w-2.5 h-2.5"} rounded-full shrink-0 ring-1 ring-black/15`} style={{ background: badge.color }} />{badge.name}</span>;
}
export function BadgeDots({ badges, max = 4 }: { badges?: ProfileBadge[]; max?: number }) {
  if (!badges?.length) return null;
  return <span className="inline-flex items-center gap-1 align-middle" aria-label={`Odznaki: ${badges.map((b) => b.name).join(", ")}`}>{badges.slice(0, max).map((badge) => <span key={badge.badge} title={badge.name} className="w-2.5 h-2.5 rounded-full ring-1 ring-black/15" style={{ background: badge.color }} />)}{badges.length > max && <span className="text-[10px] text-[var(--muted)]">+{badges.length - max}</span>}</span>;
}

export function Btn({
  children,
  onClick,
  kind = "ghost",
  className = "",
  disabled,
  type = "button",
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  kind?: "primary" | "ghost" | "soft" | "danger";
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit";
  title?: string;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg font-semibold text-sm transition-all duration-200 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none cursor-pointer";
  const styles = {
    primary: "text-[var(--on-accent)] px-4 py-2 hover:brightness-110 shadow-lg shadow-black/30",
    ghost: "border border-[var(--line2)] text-[var(--text)] px-4 py-2 hover:bg-[var(--hover)] hover:border-[var(--line2)]",
    soft: "bg-[var(--hover)] text-[var(--text)] px-4 py-2 hover:bg-[var(--hover)]",
    danger: "bg-red-500/12 text-red-700 border border-red-500/35 px-4 py-2 hover:bg-red-500/20",
  }[kind];
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${styles} ${kind === "primary" ? "style-primary" : ""} ${className}`}
      style={kind === "primary" ? { background: "linear-gradient(135deg, var(--accent), var(--accent2))" } : undefined}
    >
      {children}
    </button>
  );
}

export function IconBtn({
  children,
  onClick,
  title,
  className = "",
  active,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
  className?: string;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={`p-2 rounded-full transition-all duration-200 active:scale-90 cursor-pointer disabled:opacity-30 disabled:pointer-events-none ${
        active ? "text-[var(--accent)]" : "text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--hover)]"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => onChange(!on)}
      className="relative w-11 h-6 rounded-full transition-colors duration-300 cursor-pointer shrink-0"
      style={{ background: on ? "var(--accent)" : "#c8cacc" }}
    >
      <span
        className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all duration-300"
        style={{ left: on ? 22 : 2, boxShadow: "0 1px 4px rgba(0,0,0,.4)" }}
      />
    </button>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-[var(--muted2)]">{hint}</span> : null}
    </label>
  );
}

export const inputCls =
  "w-full bg-[var(--bg2)] border border-[var(--line2)] rounded-lg px-3.5 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--muted2)] outline-none focus:border-[var(--accent)] transition-colors";

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const titleId = useId();
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", h);
      document.body.style.overflow = "";
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/75 koc-fade" onClick={onClose} />
      <div
        role="dialog" aria-modal="true" aria-labelledby={titleId}
        className={`relative w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[88vh] overflow-y-auto rounded-t-2xl sm:rounded-xl border border-[var(--line2)] bg-[var(--panel)] koc-pop shadow-2xl shadow-black/60`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 bg-[var(--panel)]/95 backdrop-blur border-b border-[var(--line)]">
          <h3 id={titleId} className="font-display font-bold text-lg">{title}</h3>
          <IconBtn onClick={onClose} title="Zamknij">
            {I.x()}
          </IconBtn>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Menu({
  items,
  align = "right",
}: {
  items: { label: string; icon?: React.ReactNode; onClick: () => void; danger?: boolean }[];
  align?: "right" | "left";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    setTimeout(() => document.addEventListener("mousedown", h), 0);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <IconBtn title="Opcje" onClick={() => setOpen((o) => !o)} className="opacity-60 group-hover:opacity-100">
        {I.dots()}
      </IconBtn>
      {open && (
        <div
          className={`absolute z-40 top-8 ${align === "right" ? "right-0" : "left-0"} min-w-[200px] rounded-xl border border-[var(--line2)] bg-[var(--panel2)] py-1.5 shadow-2xl shadow-black/60 koc-pop`}
        >
          {items.map((it, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setOpen(false);
                it.onClick();
              }}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-left transition-colors hover:bg-[var(--hover)] cursor-pointer ${
                it.danger ? "text-red-700" : "text-[var(--text)]"
              }`}
            >
              {it.icon}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SectionHead({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-4">
      <div>
        <h2 className="font-display font-bold text-xl md:text-2xl">{title}</h2>
        {sub ? <p className="text-sm text-[var(--muted)] mt-0.5">{sub}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Empty({ icon, title, sub, action }: { icon?: React.ReactNode; title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 rounded-2xl border border-dashed border-[var(--line2)]">
      <div className="text-[var(--muted)] mb-3">{icon ?? I.music({ size: 34 })}</div>
      <p className="font-display font-bold text-lg">{title}</p>
      {sub ? <p className="text-sm text-[var(--muted)] mt-1 max-w-sm">{sub}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function EqBars() {
  return (
    <span className="koc-eq" aria-hidden>
      <span /><span /><span />
    </span>
  );
}

/* ================= Wiersz utworu ================= */

export function TrackRow({
  track,
  index,
  context,
  label,
  showAlbum = true,
  showAdded = false,
  onRemove,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  dragActive,
}: {
  track: Track;
  index: number;
  context: Track[];
  label?: string;
  showAlbum?: boolean;
  showAdded?: boolean;
  onRemove?: () => void;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: () => void;
  dragActive?: boolean;
}) {
  const store = useStore();
  const player = usePlayer();
  const isCur = player.isCurrent(track);
  const ctxIdx = Math.max(0, context.findIndex((t) => t.id === track.id));
  const social = store.settings.social;

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`group grid grid-cols-[2rem_minmax(0,1fr)_4.5rem] md:grid-cols-[2rem_minmax(0,5fr)_minmax(0,3.5fr)_4.5rem_9.5rem] items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--hover)] transition-colors ${
        dragActive ? "ring-1 ring-[var(--accent)] bg-[var(--hover)]" : ""
      } ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      <button
        type="button"
        onClick={() => (isCur ? player.toggle() : player.play(context, ctxIdx, label))}
        className="relative w-8 h-8 flex items-center justify-center text-[var(--muted)] cursor-pointer"
        title={isCur && player.playing ? "Pauza" : "Odtwórz"}
        aria-label={isCur && player.playing ? "Pauza" : "Odtwórz"}
      >
        <span className={`transition-opacity ${isCur && player.playing ? "opacity-0 group-hover:opacity-100" : "group-hover:opacity-0"}`}>
          {isCur && player.playing ? <span className="text-[var(--muted)]">{index + 1}</span> : index + 1}
        </span>
        <span className={`absolute inset-0 flex items-center justify-center text-[var(--text)] transition-opacity ${isCur && player.playing ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
          {isCur && player.playing ? I.pause({ size: 14 }) : I.play({ size: 14 })}
        </span>
      </button>

      <div className="flex items-center gap-3 min-w-0">
        {draggable && <span className="hidden md:flex text-[var(--muted2)]">{I.grip({ size: 15 })}</span>}
        <div className="relative w-10 h-10 rounded-md overflow-hidden shrink-0 bg-[var(--panel2)]">
          <Cover src={track.cover} alt={track.title} className="w-full h-full" iconSize={18} />
        </div>
        <div className="min-w-0">
          <div className={`text-sm font-semibold truncate ${isCur ? "text-[var(--accent)]" : ""}`}>{track.title}</div>
          <div className="text-xs text-[var(--muted)] truncate">
            {track.artist}
            {showAdded && track.addedByName ? ` • dodane przez ${track.addedByName}` : ""}
          </div>
        </div>
      </div>

      <div className="hidden md:block text-xs text-[var(--muted)] truncate">{track.album || "—"}</div>

      <div className="hidden md:flex items-center gap-1 text-xs text-[var(--muted)]">
        {track.hasLyrics ? I.book({ size: 13, className: "text-[var(--accent2)]" }) : null}
        {fmtTime(track.duration)}
      </div>

      <div className="flex items-center justify-end gap-0.5">
        {track.hasLyrics && <span className="md:hidden mr-1 text-[var(--accent2)]">{I.book({ size: 14 })}</span>}
        <span className="md:hidden mr-1 text-xs text-[var(--muted)]">{fmtTime(track.duration)}</span>
        {social && (
          <IconBtn
            title={track.liked ? "Wypolub" : "Polub"}
            onClick={() => store.toggleTrackLike(track.id)}
            className="hidden md:block"
          >
            <span className={track.liked ? "text-[var(--accent)]" : ""}>
              {I.heart({ size: 15, filled: track.liked })}
            </span>
          </IconBtn>
        )}
        <Menu
          items={[
            { label: "Dodaj do playlisty", icon: I.plus({ size: 15 }), onClick: () => store.openModal({ type: "add-to-playlist", trackId: track.id }) },
            { label: "Do kolejki", icon: I.queue({ size: 15 }), onClick: () => { player.queueTrack(track); store.toast("Dodano do kolejki"); } },
            { label: "Tekst utworu", icon: I.book({ size: 15 }), onClick: () => store.openModal({ type: "lyrics-edit", trackId: track.id }) },
            ...(social ? [{ label: "Komentarze", icon: I.users({ size: 15 }), onClick: () => store.openModal({ type: "track-detail", trackId: track.id }) }] : []),
            ...(onRemove ? [{ label: "Usuń z playlisty", icon: I.trash({ size: 15 }), onClick: onRemove, danger: true } as const] : []),
            ...(track.addedBy === store.user?.id
              ? [{ label: "Usuń z biblioteki", icon: I.trash({ size: 15 }), onClick: () => store.deleteTrack(track.id), danger: true } as const]
              : []),
          ]}
        />
      </div>
    </div>
  );
}

/* ================= Karty ================= */

export function TrackCard({
  track,
  context,
  label,
  onOpen,
}: {
  track: Track;
  context: Track[];
  label?: string;
  onOpen?: () => void;
}) {
  const store = useStore();
  const player = usePlayer();
  const isCur = player.isCurrent(track);
  return (
    <div className="koc-card group rounded-xl bg-[var(--panel)] border border-[var(--line)] p-3 cursor-pointer" onClick={onOpen}>
      <div className="relative rounded-lg overflow-hidden aspect-square">
        <Cover src={track.cover} alt={track.title} className="w-full h-full transition-transform duration-500 group-hover:scale-[1.05]" iconSize={30} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (isCur) player.toggle();
            else player.play(context, Math.max(0, context.findIndex((t) => t.id === track.id)), label);
          }}
          className="absolute right-2.5 bottom-2.5 w-11 h-11 rounded-full flex items-center justify-center text-[var(--on-accent)] shadow-xl shadow-black/50 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 cursor-pointer"
          style={{ background: "linear-gradient(135deg, var(--accent), var(--accent2))" }}
          title="Odtwórz"
        >
          {isCur && player.playing ? I.pause({ size: 18 }) : I.play({ size: 18 })}
        </button>
        {isCur && (
          <div className="absolute left-2.5 top-2.5 w-7 h-7 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-[var(--accent)]">
            {player.playing ? <EqBars /> : I.play({ size: 12 })}
          </div>
        )}
      </div>
      <div className="mt-2.5 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className={`text-sm font-semibold truncate ${isCur ? "text-[var(--accent)]" : ""}`}>{track.title}</div>
          <div className="text-xs text-[var(--muted)] truncate">{track.artist}</div>
        </div>
        {store.settings.social && (
          <span
            className="flex items-center gap-1 text-[11px] text-[var(--muted)] shrink-0 mt-0.5"
            title="Polubienia"
          >
            <span className={track.liked ? "text-[var(--accent)]" : ""}>{I.heart({ size: 11, filled: track.liked })}</span>
            {track.likes > 0 ? track.likes : ""}
          </span>
        )}
      </div>
    </div>
  );
}

export function PlaylistCard({ playlist, onClick }: { playlist: Playlist; onClick?: () => void }) {
  const store = useStore();
  const player = usePlayer();
  return (
    <div
      className="koc-card group relative rounded-xl bg-[var(--panel)] border border-[var(--line)] p-3 cursor-pointer"
      onClick={onClick}
    >
      <div className="relative rounded-lg overflow-hidden aspect-square">
        <Cover src={playlist.cover} alt={playlist.name} className="w-full h-full transition-transform duration-500 group-hover:scale-[1.05]" iconSize={30} />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (playlist.tracks.length) player.play(playlist.tracks, 0, playlist.name);
          }}
          className="absolute right-2.5 bottom-2.5 w-11 h-11 rounded-full flex items-center justify-center text-[var(--on-accent)] shadow-xl shadow-black/50 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 cursor-pointer disabled:opacity-0"
          style={{ background: "linear-gradient(135deg, var(--accent), var(--accent2))" }}
          title="Odtwórz"
          disabled={!playlist.tracks.length}
        >
          {I.play({ size: 18 })}
        </button>
      </div>
      <div className="mt-2.5">
        <div className="text-sm font-semibold truncate">{playlist.name}</div>
        <div className="text-xs text-[var(--muted)] truncate">
          {playlist.ownerName} • {playlist.tracks.length} {playlist.tracks.length === 1 ? "utwór" : "utwory"}
        </div>
        {playlist.isPrivate && (
          <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-[var(--muted2)]">{I.eye({ size: 11, off: true })} prywatna</div>
        )}
      </div>
    </div>
  );
}
