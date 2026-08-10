"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { coverColors, type PlayableTrack } from "@/lib/presentation";

type Ctx = {
  track: PlayableTrack | null;
  play: (t: PlayableTrack) => void;
  close: () => void;
};

const PlayerCtx = createContext<Ctx>({ track: null, play: () => {}, close: () => {} });
export const usePlayer = () => useContext(PlayerCtx);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [track, setTrack] = useState<PlayableTrack | null>(null);
  return (
    <PlayerCtx.Provider value={{ track, play: setTrack, close: () => setTrack(null) }}>
      {children}
      <PlayerBar />
    </PlayerCtx.Provider>
  );
}

function fmt(s: number): string {
  if (!Number.isFinite(s)) return "0:00";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h > 0
    ? `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`
    : `${m}:${sec.toString().padStart(2, "0")}`;
}

const RATES = [0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2];

function PlayerBar() {
  const { track, close } = usePlayer();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [rate, setRate] = useState(1);
  const [vol, setVol] = useState(1);
  const [speedOpen, setSpeedOpen] = useState(false);

  useEffect(() => {
    setCur(0);
    setDur(0);
    setRate(1);
    setPlaying(track?.kind === "audio");
  }, [track?.src, track?.kind]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, [rate, track?.src]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = vol;
  }, [vol, track?.src]);

  // --- Reproducción en segundo plano ---
  // Sin Media Session el sistema no sabe que esto es "un reproductor" y el audio
  // se corta al bloquear el teléfono o cambiar de app. Registrando metadata +
  // handlers, iOS y Android lo tratan como música: sigue sonando con la pantalla
  // apagada y aparecen los controles en la pantalla de bloqueo.
  // (El iframe de YouTube NO puede hacer esto: YouTube bloquea la reproducción en
  // segundo plano fuera de Premium. Por eso el reproductor prefiere el mp3 propio.)
  useEffect(() => {
    const ms = typeof navigator !== "undefined" ? navigator.mediaSession : undefined;
    if (!ms || !track || track.kind !== "audio") return;

    ms.metadata = new MediaMetadata({
      title: track.title,
      artist: track.author,
      album: "Biblioteca Abierta",
      ...(track.cover ? { artwork: [{ src: track.cover, sizes: "512x512", type: "image/jpeg" }] } : {}),
    });

    const el = () => audioRef.current;
    const seekBy = (d: number) => {
      const a = el();
      if (a) a.currentTime = Math.max(0, Math.min(a.duration || 0, a.currentTime + d));
    };
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ["play", () => el()?.play()],
      ["pause", () => el()?.pause()],
      ["seekbackward", () => seekBy(-15)],
      ["seekforward", () => seekBy(30)],
      ["seekto", (d) => { const a = el(); if (a && d.seekTime != null) a.currentTime = d.seekTime; }],
    ];
    for (const [action, fn] of handlers) {
      try { ms.setActionHandler(action, fn); } catch { /* acción no soportada */ }
    }
    return () => {
      for (const [action] of handlers) {
        try { ms.setActionHandler(action, null); } catch { /* */ }
      }
    };
  }, [track]);

  // El sistema operativo necesita saber si está sonando y por dónde va, o los
  // controles del lock screen quedan congelados.
  useEffect(() => {
    const ms = typeof navigator !== "undefined" ? navigator.mediaSession : undefined;
    if (!ms || track?.kind !== "audio") return;
    ms.playbackState = playing ? "playing" : "paused";
    if (dur > 0 && Number.isFinite(dur)) {
      try {
        ms.setPositionState({ duration: dur, position: Math.min(cur, dur), playbackRate: rate });
      } catch { /* algunos navegadores no lo soportan */ }
    }
  }, [playing, cur, dur, rate, track?.kind]);

  if (!track) return null;
  const [from, to] = coverColors(track.slug);
  const isAudio = track.kind === "audio";

  const skip = (d: number) => {
    const a = audioRef.current;
    if (a) a.currentTime = Math.max(0, Math.min((a.duration || 0), a.currentTime + d));
  };
  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    a.paused ? a.play() : a.pause();
  };
  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    if (!a || !dur) return;
    const r = e.currentTarget.getBoundingClientRect();
    a.currentTime = ((e.clientX - r.left) / r.width) * dur;
  };
  const pct = dur ? (cur / dur) * 100 : 0;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line/80 bg-surface/98 shadow-[0_-12px_40px_-10px_rgba(33,28,24,0.4)] backdrop-blur-xl">
      {/* tinte sutil del color de la tapa */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{ background: `linear-gradient(90deg, ${from}, ${to})` }}
      />
      <div className="relative mx-auto flex max-w-5xl items-center gap-3 px-3 py-3 sm:gap-5 sm:px-5">
        {/* Tapa + info */}
        <div className="flex min-w-0 items-center gap-3 sm:w-64 sm:shrink-0">
          <div
            className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-lg shadow-md ring-1 ring-black/5"
            style={{ background: `linear-gradient(150deg, ${from}, ${to})` }}
          >
            {track.cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={track.cover} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="font-display text-2xl font-black text-white/25 select-none" aria-hidden>
                {track.title.replace(/[^\p{L}\p{N}]/gu, "").charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{track.title}</p>
            <p className="truncate text-xs text-ink-soft">
              {!isAudio && "▶ YouTube · "}
              {track.author}
            </p>
          </div>
        </div>

        {/* Centro: transporte + progreso (solo audio propio) */}
        {isAudio ? (
          <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <div className="flex items-center gap-4 sm:gap-6">
              <button
                onClick={() => skip(-15)}
                aria-label="Atrasar 15 segundos"
                className="hidden text-ink-soft transition hover:text-ink active:scale-90 sm:block"
              >
                <Rewind />
              </button>
              <button
                onClick={toggle}
                aria-label={playing ? "Pausar" : "Reproducir"}
                className="grid h-12 w-12 place-items-center rounded-full bg-ink text-paper shadow-lg transition hover:scale-105 active:scale-95"
              >
                {playing ? (
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                    <rect x="6" y="5" width="4" height="14" rx="1" />
                    <rect x="14" y="5" width="4" height="14" rx="1" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-6 w-6 translate-x-0.5" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>
              <button
                onClick={() => skip(30)}
                aria-label="Adelantar 30 segundos"
                className="hidden text-ink-soft transition hover:text-ink active:scale-90 sm:block"
              >
                <Forward />
              </button>
            </div>
            <div className="flex w-full items-center gap-2">
              <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-ink-soft">{fmt(cur)}</span>
              <div onClick={seek} className="group h-1.5 flex-1 cursor-pointer rounded-full bg-line">
                <div className="relative h-full rounded-full bg-accent" style={{ width: `${pct}%` }}>
                  <span className="absolute top-1/2 right-0 h-3 w-3 -translate-y-1/2 translate-x-1/2 rounded-full bg-accent opacity-0 shadow transition group-hover:opacity-100" />
                </div>
              </div>
              <span className="w-10 shrink-0 text-[11px] tabular-nums text-ink-soft">{fmt(dur)}</span>
            </div>
          </div>
        ) : (
          <iframe
            key={track.src}
            className="aspect-video h-14 flex-1 rounded-lg bg-black"
            src={`https://www.youtube.com/embed/${track.src}?autoplay=1`}
            title={track.title}
            allow="autoplay; encrypted-media"
          />
        )}

        {/* Derecha: volumen + velocidad + cerrar */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {isAudio && (
            <div className="hidden items-center gap-1.5 md:flex">
              <button
                onClick={() => setVol((v) => (v > 0 ? 0 : 1))}
                aria-label="Volumen"
                className="text-ink-soft transition hover:text-ink"
              >
                {vol === 0 ? (
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 5 6 9H3v6h3l5 4zM22 9l-6 6M16 9l6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 5 6 9H3v6h3l5 4zM16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={vol}
                onChange={(e) => setVol(Number(e.target.value))}
                aria-label="Nivel de volumen"
                className="h-1 w-16 cursor-pointer accent-accent"
              />
            </div>
          )}
          {isAudio && (
            <div className="relative">
              <button
                onClick={() => setSpeedOpen((v) => !v)}
                title="Velocidad"
                className="rounded-full px-2.5 py-1 text-xs font-bold tabular-nums text-ink-soft transition hover:bg-paper hover:text-ink"
              >
                {rate}×
              </button>
              {speedOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setSpeedOpen(false)} />
                  <div className="absolute right-0 bottom-full z-20 mb-2 max-h-64 w-20 overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-xl">
                    {RATES.map((r) => (
                      <button
                        key={r}
                        onClick={() => { setRate(r); setSpeedOpen(false); }}
                        className={`block w-full rounded-lg px-2 py-1.5 text-center text-sm tabular-nums transition ${
                          r === rate ? "bg-accent text-white font-bold" : "text-ink-soft hover:bg-paper hover:text-ink"
                        }`}
                      >
                        {r}×
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          <button
            onClick={close}
            aria-label="Cerrar reproductor"
            title="Cerrar"
            className="grid h-9 w-9 place-items-center rounded-full text-ink-soft transition hover:bg-paper hover:text-ink"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {isAudio && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio
          key={track.src}
          ref={audioRef}
          src={track.src}
          autoPlay
          className="hidden"
          onLoadedMetadata={(e) => {
            setDur(e.currentTarget.duration);
            e.currentTarget.playbackRate = rate;
          }}
          onTimeUpdate={(e) => setCur(e.currentTarget.currentTime)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />
      )}
    </div>
  );
}

function Rewind() {
  return (
    <span className="relative inline-flex items-center">
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M11 7L6 12l5 5M18 7l-5 5 5 5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 text-[8px] font-bold">15</span>
    </span>
  );
}
function Forward() {
  return (
    <span className="relative inline-flex items-center">
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M13 7l5 5-5 5M6 7l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 text-[8px] font-bold">30</span>
    </span>
  );
}

export function PlayButton({
  track,
  className,
  children,
  ariaLabel,
}: {
  track: PlayableTrack;
  className?: string;
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  const { play } = usePlayer();
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        play(track);
      }}
      className={className}
    >
      {children}
    </button>
  );
}
