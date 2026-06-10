"use client";

import { useState } from "react";
import type { Book, AudioVersion } from "@/lib/types";
import type { PlayableTrack } from "@/lib/presentation";
import { PlayButton } from "@/components/player/Player";

// Sección "Escuchar" de la ficha — usa el reproductor flotante (sigue sonando
// al navegar). Solo audio PROPIO (YouTube de nuestro canal o mp3 IA).
function trackFor(book: Book, v: AudioVersion): PlayableTrack | null {
  if (v.youtubeVideoId && v.youtubePublic)
    return { title: book.title, author: book.author, slug: book.slug, kind: "youtube", src: v.youtubeVideoId, cover: book.coverImageUrl };
  if (v.audioUrl && v.status === "ready")
    return { title: book.title, author: book.author, slug: book.slug, kind: "audio", src: v.audioUrl, cover: book.coverImageUrl };
  return null;
}

export function AudioSection({ book }: { book: Book }) {
  const playable = book.audioVersions
    .filter((v) => v.voiceId !== "librivox")
    .map((v) => ({ v, track: trackFor(book, v) }))
    .filter((x): x is { v: AudioVersion; track: PlayableTrack } => x.track !== null);

  const [selected, setSelected] = useState(0);
  const current = playable[selected];

  const label = (v: AudioVersion) =>
    v.voiceId === "onyx" ? "Onyx" : v.voiceId === "nova" ? "Nova" : v.voiceName;

  if (!current) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface px-4 py-9 text-center shadow-sm">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-accent-soft text-2xl">🎧</span>
        <p className="mt-3 font-semibold text-ink">Audio en preparación</p>
        <p className="mt-1 max-w-sm text-sm text-ink-soft">
          Estamos narrando este libro. Muy pronto vas a poder escucharlo acá.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-sm">
      <PlayButton
        track={current.track}
        className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 font-semibold text-white shadow-lg shadow-accent/25 transition hover:bg-accent-dark active:scale-95"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
        Escuchar
      </PlayButton>

      {playable.length > 1 && (
        <div className="flex gap-1 rounded-full bg-paper p-1">
          {playable.map((x, i) => (
            <button
              key={x.v.voiceId}
              onClick={() => setSelected(i)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                i === selected ? "bg-ink text-paper shadow-sm" : "text-ink-soft hover:text-ink"
              }`}
            >
              {label(x.v)}
            </button>
          ))}
        </div>
      )}
      <span className="ml-auto pr-1 text-xs text-ink-soft">Voz {label(current.v)}</span>
    </div>
  );
}
