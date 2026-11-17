"use client";
import React, { useCallback, useEffect, useState } from "react";
import { api, useStore } from "./ctx";
import { Avatar, Btn, Empty, Field, SectionHead } from "./ui";
import type { UserLite } from "@/lib/types";

type FriendData = { friends: UserLite[]; incoming: { id: string; user: UserLite }[]; outgoing: { id: string; user: UserLite }[] };
type Message = { id: string; senderId: string; receiverId: string; body: string; readAt: string | null; createdAt: string };
type AdminData = {
  users: { id: string; username: string; displayName: string; accountStatus: string; suspendedUntil: string | null; createdAt: string }[];
  reports: { id: string; reporterId: string; targetType: string; targetId: string; reason: string; status: string; createdAt: string }[];
  actions: { id: string; targetUserId: string; action: string; reason: string; createdAt: string }[];
  library: { id: string; title: string; artist: string; playlists: number; createdAt: string }[];
};

type NotificationItem = {
  id: string; type: string; title: string; body: string; href: string | null;
  readAt: string | null; createdAt: string; actorId: string | null;
  actorName: string | null; actorUsername: string | null; actorAvatar: string | null;
};

export function NotificationsView() {
  const store = useStore();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const result = await api<{ notifications: NotificationItem[]; unread: number }>("/api/notifications");
      setItems(result.notifications);
      setUnread(result.unread);
      setError("");
    } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => {
    if (!store.user) return;
    void load();
    const timer = setInterval(() => void load(), 30_000);
    return () => clearInterval(timer);
  }, [load, store.user?.id]);
  const markAll = async () => {
    try { await api("/api/notifications", { method: "PATCH", body: JSON.stringify({ all: true }) }); await load(); }
    catch (e) { setError((e as Error).message); }
  };
  const openItem = async (item: NotificationItem) => {
    if (!item.readAt) await api("/api/notifications", { method: "PATCH", body: JSON.stringify({ id: item.id }) }).catch(() => {});
    if (item.href === "friends") store.setView({ name: "friends" });
    else if (item.href?.startsWith("track:")) store.openModal({ type: "track-detail", trackId: item.href.slice(6) });
    else if (item.actorUsername) store.setView({ name: "profile", username: item.actorUsername });
    void load();
  };
  if (!store.user) return <Empty title="Powiadomienia" sub="Zaloguj się, aby zobaczyć powiadomienia." />;
  return <div className="space-y-5">
    <SectionHead title="Powiadomienia" sub={unread ? unread + " nieprzeczytanych" : "Wszystko nadrobione"} action={<Btn kind="soft" disabled={!unread} onClick={() => void markAll()}>Oznacz wszystkie jako przeczytane</Btn>} />
    {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
    <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-2">
      {items.map(item => <button key={item.id} type="button" onClick={() => void openItem(item)} className={"w-full text-left flex items-start gap-3 rounded-lg p-3 hover:bg-[var(--hover)] border-b border-[var(--line)] last:border-0 " + (item.readAt ? "opacity-70" : "bg-[var(--accent)]/5")}>
        <Avatar user={{ id: item.actorId ?? "", username: item.actorUsername ?? "", displayName: item.actorName ?? "Koczowisko", avatar: item.actorAvatar ?? null, bio: "", isSystem: false }} size={38}/>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2"><b className="text-sm">{item.title}</b>{!item.readAt && <span className="w-2 h-2 rounded-full bg-[var(--accent)]"/>}</span>
          <span className="block text-sm text-[var(--muted)] mt-0.5">{item.body}</span>
          <span className="block text-[11px] text-[var(--muted2)] mt-1">{new Date(item.createdAt).toLocaleString("pl-PL")}</span>
        </span>
      </button>)}
      {!items.length && <p className="text-sm text-[var(--muted)] text-center p-10">Na razie cisza. Nowe aktywności pojawią się tutaj.</p>}
    </section>
  </div>;
}

export function FriendsView() {
  const store = useStore();
  const [data, setData] = useState<FriendData | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<UserLite | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try { setData(await api<FriendData>("/api/friends")); }
    catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { if (store.user) void load(); }, [store.user?.id, load]);
  const act = async (action: string, userId: string) => {
    try { await api("/api/friends", { method: "POST", body: JSON.stringify({ action, userId }) }); await load(); }
    catch (e) { setError((e as Error).message); }
  };
  const search = async () => {
    const username = query.trim().replace(/^@/, "");
    if (!username) return;
    setBusy(true); setError("");
    try {
      const found = await api<{ profile: { user: UserLite } }>(`/api/users/${encodeURIComponent(username)}`);
      if (found.profile.user.id === store.user?.id) throw new Error("To jest Twoje konto.");
      await act("send", found.profile.user.id);
      setQuery("");
      store.toast("Zaproszenie wysłane lub zaakceptowane.");
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const openChat = async (user: UserLite) => {
    setSelected(user);
    try { const r = await api<{ messages: Message[] }>(`/api/messages?with=${encodeURIComponent(user.id)}`); setMessages(r.messages); }
    catch (e) { setError((e as Error).message); setMessages([]); }
  };
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !draft.trim()) return;
    try {
      const r = await api<{ message: Message }>("/api/messages", { method: "POST", body: JSON.stringify({ userId: selected.id, body: draft.trim() }) });
      setMessages(prev => [...prev, r.message]); setDraft("");
    } catch (e) { setError((e as Error).message); }
  };
  if (!store.user) return <Empty title="Znajomi czekają na Ciebie" sub="Zaloguj się, aby wysyłać zaproszenia i rozmawiać." />;
  return <div className="space-y-6">
    <SectionHead title="Znajomi" sub="Zaproszenia, lista znajomych i prywatne rozmowy" />
    <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 space-y-3">
      <Field label="Dodaj znajomego" hint="Wpisz dokładny login użytkownika.">
        <div className="flex gap-2"><input className="min-w-0 flex-1 rounded-lg border border-[var(--line2)] bg-[var(--bg)] px-3 py-2 text-sm" value={query} onChange={e => setQuery(e.target.value)} placeholder="@login" onKeyDown={e => { if(e.key==="Enter") void search(); }} /><Btn kind="primary" disabled={busy || !query.trim()} onClick={() => void search()}>{busy ? "Szukam…" : "Wyślij zaproszenie"}</Btn></div>
      </Field>
      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
    </section>
    <div className="grid lg:grid-cols-2 gap-4">
      <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 space-y-3">
        <h3 className="font-display font-bold">Zaproszenia przychodzące ({data?.incoming.length ?? 0})</h3>
        {(data?.incoming ?? []).map(x => <div key={x.id} className="flex items-center gap-3"><Avatar user={x.user} size={36}/><div className="min-w-0 flex-1"><b className="text-sm">{x.user.displayName}</b><div className="text-xs text-[var(--muted)]">@{x.user.username}</div></div><Btn kind="primary" onClick={() => void act("accept",x.id)}>Akceptuj</Btn><Btn kind="ghost" onClick={() => void act("decline",x.id)}>Odrzuć</Btn></div>)}
        {!data?.incoming.length && <p className="text-sm text-[var(--muted)]">Brak nowych zaproszeń.</p>}
      </section>
      <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 space-y-3">
        <h3 className="font-display font-bold">Wysłane zaproszenia ({data?.outgoing.length ?? 0})</h3>
        {(data?.outgoing ?? []).map(x => <div key={x.id} className="flex items-center gap-3"><Avatar user={x.user} size={36}/><div className="min-w-0 flex-1"><b className="text-sm">{x.user.displayName}</b><div className="text-xs text-[var(--muted)]">@{x.user.username}</div></div><Btn kind="ghost" onClick={() => void act("remove",x.id)}>Anuluj</Btn></div>)}
        {!data?.outgoing.length && <p className="text-sm text-[var(--muted)]">Brak wysłanych zaproszeń.</p>}
      </section>
    </div>
    <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 space-y-3">
      <h3 className="font-display font-bold">Twoi znajomi ({data?.friends.length ?? 0})</h3>
      {(data?.friends ?? []).map(u => <div key={u.id} className="flex items-center gap-3"><Avatar user={u} size={40}/><button className="text-left min-w-0 flex-1" onClick={() => store.setView({name:"profile",username:u.username})}><b className="text-sm">{u.displayName}</b><div className="text-xs text-[var(--muted)]">@{u.username}</div></button><Btn kind="soft" onClick={() => void openChat(u)}>Wiadomość</Btn><Btn kind="ghost" onClick={() => void act("remove",u.id)}>Usuń</Btn></div>)}
      {!data?.friends.length && <p className="text-sm text-[var(--muted)]">Nie masz jeszcze znajomych.</p>}
    </section>
    {selected && <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 space-y-3">
      <div className="flex items-center justify-between"><h3 className="font-display font-bold">Rozmowa z {selected.displayName}</h3><Btn kind="ghost" onClick={() => setSelected(null)}>Zamknij</Btn></div>
      <div className="max-h-72 min-h-24 overflow-y-auto space-y-2 rounded-lg bg-[var(--bg)] p-3">{messages.map(m => <div key={m.id} className={m.senderId === store.user?.id ? "text-right" : "text-left"}><span className="inline-block max-w-[85%] rounded-xl bg-[var(--bg2)] px-3 py-2 text-sm">{m.body}</span><div className="text-[10px] text-[var(--muted2)] mt-1">{new Date(m.createdAt).toLocaleString("pl-PL")}</div></div>)}</div>
      <form onSubmit={sendMessage} className="flex gap-2"><input className="min-w-0 flex-1 rounded-lg border border-[var(--line2)] bg-[var(--bg)] px-3 py-2 text-sm" value={draft} onChange={e => setDraft(e.target.value)} maxLength={2000} placeholder="Napisz wiadomość…" /><Btn kind="primary" type="submit" disabled={!draft.trim()}>Wyślij</Btn></form>
    </section>}
  </div>;
}

export function AdminView() {
  const store = useStore();
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("Naruszenie zasad społeczności");
  const load = useCallback(async () => {
    try { setData(await api<AdminData>("/api/admin")); setError(""); }
    catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const action = async (payload: Record<string, unknown>) => {
    try { await api("/api/admin", { method: "POST", body: JSON.stringify(payload) }); await load(); }
    catch (e) { setError((e as Error).message); }
  };
  if (!store.badges.some(b => b.badge === "tworcy")) return <Empty title="Brak dostępu" sub="Panel administracyjny wymaga odznaki Twórcy Koczowiska." />;
  return <div className="space-y-6">
    <SectionHead title="Centrum administracji" sub="Zarządzanie zgłoszeniami, kontami i historią moderacji" action={<Btn kind="soft" onClick={() => void load()}>Odśwież</Btn>} />
    {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
    <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 space-y-3">
      <h3 className="font-display font-bold">Zgłoszenia ({data?.reports.filter(r => r.status === "open").length ?? 0} otwartych)</h3>
      {(data?.reports ?? []).map(r => <div key={r.id} className="border-b border-[var(--line)] py-3 last:border-0"><div className="flex flex-wrap justify-between gap-2"><b className="text-sm">{r.targetType} · {r.targetId}</b><span className="text-xs text-[var(--muted)]">{r.status} · {new Date(r.createdAt).toLocaleString("pl-PL")}</span></div><p className="text-sm mt-1">{r.reason}</p>{r.status === "open" && <div className="flex gap-2 mt-2"><Btn kind="primary" onClick={() => void action({action:"review-report",reportId:r.id,status:"reviewed"})}>Rozpatrz</Btn><Btn kind="ghost" onClick={() => void action({action:"review-report",reportId:r.id,status:"dismissed"})}>Odrzuć</Btn></div>}</div>)}
      {!data?.reports.length && <p className="text-sm text-[var(--muted)]">Brak zgłoszeń.</p>}
    </section>
    <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 space-y-3">
      <h3 className="font-display font-bold">Użytkownicy ({data?.users.length ?? 0})</h3>
      <Field label="Powód blokady"><input className="w-full rounded-lg border border-[var(--line2)] bg-[var(--bg)] px-3 py-2 text-sm" value={reason} onChange={e => setReason(e.target.value)} maxLength={500}/></Field>
      {(data?.users ?? []).map(u => <div key={u.id} className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] py-2 last:border-0"><div className="min-w-0 flex-1"><b className="text-sm">{u.displayName}</b><div className="text-xs text-[var(--muted)]">@{u.username} · {u.accountStatus}</div></div>{u.accountStatus === "suspended" ? <Btn kind="soft" onClick={() => void action({action:"unsuspend",userId:u.id})}>Odblokuj</Btn> : <Btn kind="ghost" onClick={() => void action({action:"suspend",userId:u.id,reason,minutes:60})}>Blokuj 1h</Btn>}<Btn kind="ghost" onClick={() => void action({action:"suspend",userId:u.id,reason,minutes:0})}>Blokuj</Btn></div>)}
    </section>
    <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 space-y-3">
      <div className="flex items-center justify-between gap-2"><h3 className="font-display font-bold">Biblioteka utworów ({data?.library.length ?? 0})</h3><span className="text-xs text-[var(--muted)]">Usuwanie trwałe</span></div>
      {(data?.library ?? []).map(track => <div key={track.id} className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] py-2 last:border-0">
        <div className="min-w-0 flex-1"><b className="text-sm block truncate">{track.title}</b><span className="text-xs text-[var(--muted)]">{track.artist} · {track.playlists} playlist</span></div>
        <Btn kind="danger" onClick={() => { if (window.confirm(`Trwale usunąć „${track.title}” z biblioteki i wszystkich playlist? Tej operacji nie można cofnąć.`)) void action({ action: "delete-track", trackId: track.id }); }}>Usuń trwale</Btn>
      </div>)}
      {!data?.library.length && <p className="text-sm text-[var(--muted)]">Biblioteka jest pusta.</p>}
    </section>
    <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 space-y-2"><h3 className="font-display font-bold">Ostatnie działania moderacji</h3>{(data?.actions ?? []).map(a => <div key={a.id} className="text-sm border-b border-[var(--line)] py-2 last:border-0">{a.action} · {a.reason} <span className="text-xs text-[var(--muted)]">{new Date(a.createdAt).toLocaleString("pl-PL")}</span></div>)}{!data?.actions.length && <p className="text-sm text-[var(--muted)]">Brak zapisanych działań.</p>}</section>
  </div>;
}
