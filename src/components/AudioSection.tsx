"use client";

import { useState } from "react";
import type { AudioVersion } from "@/lib/types";

function voiceLabel(v: AudioVersion): string {
  if (v.voiceId === "librivox") return "🎧 LibriVox";
  if (v.voiceId === "onyx") return "♂ Onyx";
  if (v.voiceId === "nova") return "♀ Nova";
  return v.voiceName;
}

// Selector de voz + reproductor. Prioridad de reproducción:
//   1) grabación LibriVox en archive.org (audio real, ya disponible)
//   2) video de YouTube (narrado TTS subido en Fase 4)
//   3) estado "en preparación"
export function AudioSection({
  versions,
  librivoxUrl,
}: {
  versions: AudioVersion[];
  librivoxUrl?: string | null;
}) {
  const [selected, setSelected] = useState(0);
  const current = versions[selected];

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-semibold text-stone-900">Escuchar</h2>
        {versions.length > 0 && (
          <div className="flex flex-wrap gap-1 rounded-lg bg-stone-100 p-1">
            {versions.map((v, i) => (
              <button
                key={v.voiceId}
                onClick={() => setSelected(i)}
                className={`rounded-md px-3 py-1 text-sm font-medium transition ${
                  i === selected
                    ? "bg-white text-stone-900 shadow-sm"
                    : "text-stone-500 hover:text-stone-800"
                }`}
              >
                {voiceLabel(v)}
              </button>
            ))}
          </div>
        )}
      </div>

      {current?.youtubeVideoId && current.youtubePublic ? (
        <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
          <iframe
            className="h-full w-full"
            src={`https://www.youtube.com/embed/${current.youtubeVideoId}`}
            title="Reproductor de audiolibro"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : current?.audioUrl && current.status === "ready" ? (
        <div>
          <audio controls preload="none" className="w-full" src={current.audioUrl}>
            Tu navegador no puede reproducir el audio.
          </audio>
          <p className="mt-2 text-xs text-stone-500">
            Narrado con IA · voz {current.voiceId === "onyx" ? "Onyx" : "Nova"} ·
            desde el Capítulo 1.
          </p>
        </div>
      ) : current?.archiveId && current.status === "ready" ? (
        <div>
          <iframe
            className="w-full overflow-hidden rounded-lg"
            src={`https://archive.org/embed/${current.archiveId}`}
            height={200}
            title="Reproductor de audiolibro (LibriVox / archive.org)"
            allow="autoplay"
          />
          <p className="mt-2 text-xs text-stone-500">
            Grabación de voluntarios de LibriVox (dominio público).
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-stone-300 bg-stone-50 px-4 py-8 text-center">
          <span className="text-3xl">🎧</span>
          <p className="mt-2 font-medium text-stone-700">Audio en preparación</p>
          <p className="mt-1 max-w-sm text-sm text-stone-500">
            Estamos generando el narrado con la voz{" "}
            <strong>{current?.voiceId === "onyx" ? "Onyx" : "Nova"}</strong>.
            Mientras tanto, ya podés descargar el e-book gratis.
          </p>
          {librivoxUrl && (
            <a
              href={librivoxUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 text-sm font-medium text-amber-700 hover:text-amber-900"
            >
              Escuchar una grabación en LibriVox ↗
            </a>
          )}
        </div>
      )}
    </div>
  );
}
