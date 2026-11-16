"use client";
import { useEffect, useRef, useState } from "react";
import { usePlayer, useStore } from "./ctx";
import { Cover, EqBars, I, IconBtn, KoczMark } from "./ui";
import { fmtTime } from "@/lib/types";

export function PlayerBar({ onOpenPanel }: { onOpenPanel: (p: "queue" | "history") => void }) {
  const player = usePlayer();
  const store = useStore();
  const [drag, setDrag] = useState(false);
  const barRef = useRef<HTMLInputElement>(null);

  const dur = player.duration || player.current?.duration || 0;
  const pct = dur ? Math.min(100, (player.position / dur) * 100) : 0;
  const volPct = (player.muted ? 0 : player.volume) * 100;

  useEffect(() => {
    document.title = player.current
      ? `${player.current.title} – ${player.current.artist} | Koczowisko`
      : "Koczowisko – twój szkic dźwięku";
  }, [player.current]);

  if (!player.current) {
    return (
      <div className="h-[86px] shrink-0 border-t border-[var(--line)] bg-[var(--panel)]/80 backdrop-blur flex items-center justify-center gap-3 text-[var(--muted)] text-sm px-6">
        <KoczMark className="w-11 h-8 object-contain rounded-sm" alt="" />
        Wybierz utwór i zapisz pierwszą linijkę swojego odsłuchu.
      </div>
    );
  }

  const t = player.current;

  return (
    <div className="h-[86px] shrink-0 border-t border-[var(--line)] bg-[var(--panel)]/90 backdrop-blur flex items-center gap-3 px-3 md:px-5 relative z-30">
      {/* Lewa strona – utwór */}
      <div className="flex items-center gap-2 w-[52px] sm:w-[26%] sm:min-w-[150px] shrink-0">
        <div className="relative w-11 h-11 sm:w-[52px] sm:h-[52px] rounded-lg overflow-hidden bg-[var(--panel2)] shrink-0">
          <Cover src={t.cover} alt={t.title} className="w-full h-full" iconSize={20} />
          {player.playing && (
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center text-white/90">
              <EqBars />
            </div>
          )}
        </div>
        <div className="min-w-0 hidden sm:block">
          <div className="text-sm font-semibold truncate">{t.title}</div>
          <div className="text-xs text-[var(--muted)] truncate">{t.artist}</div>
          {player.label ? <div className="text-[10px] text-[var(--accent2)] truncate">w {player.label}</div> : null}
        </div>
        {store.settings.social && (
          <IconBtn
            title={t.liked ? "Wypolub" : "Polub"}
            className="hidden sm:block"
            onClick={() => store.toggleTrackLike(t.id)}
          >
            <span className={t.liked ? "text-[var(--accent)]" : ""}>{I.heart({ size: 17, filled: t.liked })}</span>
          </IconBtn>
        )}
      </div>

      {/* Środek – sterowanie + pasek */}
      <div className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
        <div className="flex items-center gap-1 md:gap-2">
          <IconBtn title={player.shuffle ? "Wyłącz losowanie" : "Losuj kolejność"} active={player.shuffle} onClick={player.toggleShuffle}>
            {I.shuffle({ size: 16 })}
          </IconBtn>
          <IconBtn title="Poprzedni" onClick={player.prev}>
            {I.prev({ size: 19 })}
          </IconBtn>
          <button
            type="button"
            onClick={player.toggle}
            title={player.playing ? "Pauza" : "Odtwórz"}
            className="w-11 h-11 rounded-full flex items-center justify-center text-[var(--on-accent)] shadow-lg shadow-black/40 hover:scale-105 active:scale-95 transition-transform cursor-pointer"
            style={{ background: "linear-gradient(135deg, var(--accent), var(--accent2))" }}
          >
            {player.playing ? I.pause({ size: 20 }) : I.play({ size: 20 })}
          </button>
          <IconBtn title="Następny" onClick={player.next}>
            {I.next({ size: 19 })}
          </IconBtn>
          <IconBtn title={`Powtarzanie: ${player.repeat}`} active={player.repeat !== "off"} onClick={player.cycleRepeat}>
            {I.repeat({ size: 16, one: player.repeat === "one" })}
          </IconBtn>
        </div>
        <div className="w-full max-w-[620px] flex items-center gap-2.5 px-1">
          <span className="text-[11px] tabular-nums text-[var(--muted)] w-9 text-right shrink-0">
            {fmtTime(player.position)}
          </span>
          <input
            ref={barRef}
            type="range"
            min={0}
            max={dur || 0}
            step={0.1}
            value={player.position}
            onChange={(e) => player.seek(Number(e.target.value))}
            onMouseDown={() => setDrag(true)}
            onMouseUp={() => setDrag(false)}
            className="koc-range flex-1 min-w-0 w-0"
            style={{ "--fill": `${pct}%` } as React.CSSProperties}
            aria-label="Pozycja odtwarzania"
          />
          <span className="text-[11px] tabular-nums text-[var(--muted)] w-9 shrink-0">{fmtTime(dur)}</span>
        </div>
      </div>

      {/* Prawa strona */}
      <div className="flex items-center justify-end gap-0.5 sm:w-[26%] sm:min-w-[150px] shrink-0">
        <IconBtn title="Tekst utworu" onClick={() => store.setView({ name: "lyrics" })} className="hidden lg:block">
          {I.book({ size: 17 })}
        </IconBtn>
        <IconBtn title="Kolejka" onClick={() => onOpenPanel("queue")} className="relative">
          {I.queue({ size: 17 })}
          {player.queue.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[var(--accent)] text-[var(--on-accent)] text-[9px] font-bold flex items-center justify-center">
              {player.queue.length}
            </span>
          )}
        </IconBtn>
        <IconBtn title="Historia" onClick={() => onOpenPanel("history")} className="hidden md:block">
          {I.clock({ size: 17 })}
        </IconBtn>
        <IconBtn title={player.muted ? "Włącz dźwięk" : "Wycisz"} onClick={player.toggleMute} className="hidden md:block">
          {I.vol({ size: 17, muted: player.muted })}
        </IconBtn>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={player.muted ? 0 : player.volume}
          onChange={(e) => player.setVolume(Number(e.target.value))}
          className="koc-range hidden md:block w-24"
          style={{ "--fill": `${volPct}%` } as React.CSSProperties}
          aria-label="Głośność"
        />
      </div>
      {drag ? null : null}
    </div>
  );
}

/* ================= Panel boczny: kolejka / historia ================= */

export function SidePanel({ kind, onClose }: { kind: "queue" | "history"; onClose: () => void }) {
  const player = usePlayer();
  const store = useStore();
  const list = kind === "queue" ? player.queue : player.history;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 koc-fade" />
      <div
        className="relative w-[340px] max-w-[90vw] h-full bg-[var(--panel)] border-l border-[var(--line2)] flex flex-col shadow-2xl shadow-black/60"
        style={{ animation: "coc-view 0.3s cubic-bezier(.22,1,.36,1) both" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--line)]">
          <h3 className="font-display font-bold text-lg flex items-center gap-2">
            {kind === "queue" ? I.queue({ size: 18 }) : I.clock({ size: 18 })}
            {kind === "queue" ? "Kolejka odtwarzania" : "Historia odtwarzania"}
            <span className="text-xs font-normal text-[var(--muted)]">({list.length})</span>
          </h3>
          <div className="flex items-center gap-1">
            {kind === "queue" && list.length > 0 && (
              <button
                type="button"
                onClick={player.clearQueue}
                className="text-xs text-[var(--muted)] hover:text-red-300 px-2 py-1 transition-colors cursor-pointer"
              >
                Wyczyść
              </button>
            )}
            <IconBtn onClick={onClose} title="Zamknij">
              {I.x({ size: 17 })}
            </IconBtn>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {list.length === 0 && (
            <p className="text-sm text-[var(--muted)] text-center py-12">
              {kind === "queue"
                ? "Kolejka jest pusta. Dodaj utwory przez menu w bibliotece."
                : "Historia jest pusta. Włącz pierwszy utwór."}
            </p>
          )}
          {list.map((t, i) => (
            <div
              key={`${t.id}-${i}`}
              className="group flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-[var(--hover)] transition-colors"
            >
              <span className="text-xs text-[var(--muted2)] w-5 text-right shrink-0">{kind === "history" ? "•" : i + 1}</span>
              <div className="w-9 h-9 rounded-md overflow-hidden bg-[var(--panel2)] shrink-0">
                <Cover src={t.cover} alt={t.title} className="w-full h-full" iconSize={15} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{t.title}</div>
                <div className="text-xs text-[var(--muted)] truncate">{t.artist}</div>
              </div>
              {kind === "queue" ? (
                <>
                  <button
                    type="button"
                    title="Odtwórz teraz"
                    onClick={() => player.jumpTo(i)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-[var(--muted)] hover:text-[var(--accent)] transition-all cursor-pointer"
                  >
                    {I.play({ size: 14 })}
                  </button>
                  <button
                    type="button"
                    title="Usuń z kolejki"
                    onClick={() => player.removeFromQueue(i)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-[var(--muted)] hover:text-red-300 transition-all cursor-pointer"
                  >
                    {I.x({ size: 14 })}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  title="Odtwórz ponownie"
                  onClick={() => player.play([t], 0)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-[var(--muted)] hover:text-[var(--accent)] transition-all cursor-pointer"
                >
                  {I.play({ size: 14 })}
                </button>
              )}
            </div>
          ))}
        </div>
        {kind === "queue" && (
          <div className="p-4 border-t border-[var(--line)] text-xs text-[var(--muted)]">
            Wskazówka: z menu utworu (trzy kropki) możesz dodać utwór do kolejki jednym kliknięciem.
          </div>
        )}
      </div>
    </div>
  );
}
