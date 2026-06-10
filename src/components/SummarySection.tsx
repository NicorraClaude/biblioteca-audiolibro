"use client";

import { useState } from "react";
import type { Book, Language } from "@/lib/types";
import { PlayButton } from "@/components/player/Player";

// Sinopsis (sin spoilers) y Resumen (recuento completo), en texto + audio, ES/EN.
export function SummarySection({ book }: { book: Book }) {
  const summary = book.summary;
  const langs = (["es", "en"] as const).filter(
    (l) => summary?.[l]?.sinopsis || summary?.[l]?.resumen,
  );

  const [lang, setLang] = useState<Language>(langs[0] ?? "es");
  const langData = summary?.[lang];
  const tiers = (["sinopsis", "resumen"] as const).filter((t) => langData?.[t]);
  const [tier, setTier] = useState<"sinopsis" | "resumen">("sinopsis");

  if (langs.length === 0) return null;
  const activeTier = langData?.[tier] ? tier : tiers[0];
  const entry = activeTier ? langData?.[activeTier] : undefined;
  if (!entry) return null;

  const mins = Math.max(1, Math.round(entry.text.length / 900));

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {/* Sinopsis / Resumen */}
        <div className="flex gap-1 rounded-full bg-paper p-1">
          {(["sinopsis", "resumen"] as const).map((t) => (
            <Toggle
              key={t}
              on={activeTier === t}
              disabled={!langData?.[t]}
              onClick={() => setTier(t)}
            >
              {t === "sinopsis" ? "Sinopsis" : "Resumen"}
            </Toggle>
          ))}
        </div>

        {/* Idioma */}
        {langs.length > 1 && (
          <div className="flex gap-1 rounded-full bg-paper p-1">
            {langs.map((l) => (
              <Toggle key={l} on={l === lang} onClick={() => setLang(l)}>
                {l === "es" ? "🇪🇸" : "🇬🇧"}
              </Toggle>
            ))}
          </div>
        )}

        <span className="text-xs text-ink-soft">~{mins} min de lectura</span>

        {entry.audioUrl ? (
          <PlayButton
            track={{
              title: `${activeTier === "sinopsis" ? "Sinopsis" : "Resumen"} · ${book.title}`,
              author: book.author,
              slug: book.slug,
              kind: "audio",
              src: entry.audioUrl,
              cover: book.coverImageUrl,
            }}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-dark active:scale-95"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
            Escuchar
          </PlayButton>
        ) : (
          <span className="ml-auto rounded-full bg-paper px-3 py-1.5 text-xs font-medium text-ink-soft">
            🎧 Audio pronto
          </span>
        )}
      </div>

      <p className="leading-relaxed whitespace-pre-line text-ink/80">
        {entry.text.replace(/^["']|["']$/g, "")}
      </p>
    </div>
  );
}

function Toggle({
  on,
  onClick,
  disabled,
  children,
}: {
  on: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full px-3 py-1 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
        on ? "bg-ink text-paper shadow-sm" : "text-ink-soft hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
