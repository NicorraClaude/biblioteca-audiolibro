"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Book, Language } from "@/lib/types";
import type { PlayableTrack } from "@/lib/presentation";
import { PlayButton } from "@/components/player/Player";
import { flagFor, langCode, nameFor } from "@/lib/languages";

type Tab = "libro" | "sinopsis" | "resumen";
type Trans = { code: string; name: string };

export function BookContent({ book }: { book: Book }) {
  const hasSinopsis = !!(book.summary?.es?.sinopsis || book.summary?.en?.sinopsis);
  const hasResumen = !!(book.summary?.es?.resumen || book.summary?.en?.resumen);
  // Solo Capa 1 (dominio público) puede mostrar el texto completo de la obra.
  // En Capa 2 la ficha es 100% obra nuestra: reseña + análisis original.
  const hasLibro = book.contentLayer === 1;
  const tabs: Tab[] = [
    ...(hasLibro ? (["libro"] as Tab[]) : []),
    ...(hasSinopsis ? (["sinopsis"] as Tab[]) : []),
    ...(hasResumen ? (["resumen"] as Tab[]) : []),
  ];

  const [tab, setTab] = useState<Tab>(tabs[0] ?? "libro");
  // Ficha sin nada que mostrar todavía (ej. moderno recién creado, sin reseña).
  const nothingToShow = tabs.length === 0;
  const [lang, setLang] = useState<Language>("es");
  const [voice, setVoice] = useState<"onyx" | "nova">("onyx");

  // --- LIBRO: texto original + traducciones ---
  const orig = book.language; // idioma original del texto
  const [libroLang, setLibroLang] = useState<string>(orig);
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [manifest, setManifest] = useState<Trans[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [transOpen, setTransOpen] = useState(false);
  const [other, setOther] = useState("");

  // Carga el texto original + las traducciones disponibles al abrir LIBRO.
  useEffect(() => {
    if (tab !== "libro" || !book.gutenbergId) return;
    if (texts[orig] === undefined) {
      fetch(`/texto/${book.gutenbergId}`).then((r) => (r.ok ? r.text() : "")).then((t) =>
        setTexts((m) => ({ ...m, [orig]: t })),
      );
    }
    if (manifest.length === 0) {
      fetch(`/api/translations/${book.gutenbergId}`).then((r) => r.json()).then((j) =>
        setManifest(j.langs ?? []),
      ).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, book.gutenbergId]);

  async function loadLang(code: string, name?: string) {
    setLibroLang(code);
    if (code === orig || texts[code] !== undefined) return;
    setBusy(code);
    try {
      const r = await fetch(`/api/traducir/${book.gutenbergId}?lang=${encodeURIComponent(code)}${name ? `&name=${encodeURIComponent(name)}` : ""}`);
      const j = await r.json();
      if (j.text) {
        setTexts((m) => ({ ...m, [code]: j.text }));
        if (!manifest.some((l) => l.code === code)) setManifest((ls) => [...ls, { code, name: j.name ?? name ?? code }]);
      }
    } finally {
      setBusy(null);
    }
  }

  function translateOther() {
    const name = other.trim();
    if (!name) return;
    setTransOpen(false);
    setOther("");
    loadLang(langCode(name), name);
  }

  // Opciones de "Traducir": ES/EN (la que no es original) + idiomas del manifiesto.
  const otherLang = orig === "es" ? "en" : "es";

  // --- Idiomas de sinopsis/resumen ---
  const summaryLangs = (["es", "en"] as const).filter((l) => book.summary?.[l]?.sinopsis || book.summary?.[l]?.resumen);
  const activeLang = summaryLangs.includes(lang) ? lang : summaryLangs[0] ?? "es";

  // --- Texto a mostrar ---
  let text: string | null = null;
  if (tab === "libro") text = texts[libroLang] ?? null;
  else text = book.summary?.[activeLang]?.[tab]?.text ?? null;

  // --- Qué voces existen DE VERDAD en esta pestaña ---
  // El estado arrancaba siempre en "onyx" y la búsqueda exigía esa voz exacta. Un
  // libro narrado solo en Nova (la mitad del catálogo) mostraba "Audio en
  // preparación" con el audio ahí, listo. La voz elegida ahora es una preferencia,
  // no un requisito: si no existe, se usa la que hay.
  const vocesDisponibles: ("onyx" | "nova")[] = (() => {
    if (tab === "libro") {
      return (["onyx", "nova"] as const).filter((v) =>
        book.audioVersions.some(
          (x) => x.voiceId === v && ((x.audioUrl && x.status === "ready") || (x.youtubeVideoId && x.youtubePublic)),
        ),
      );
    }
    const e = book.summary?.[activeLang]?.[tab === "sinopsis" ? "sinopsis" : "resumen"];
    return (["onyx", "nova"] as const).filter((v) => !!e?.audio?.[v]);
  })();
  const vozEfectiva = vocesDisponibles.includes(voice) ? voice : vocesDisponibles[0];

  // --- Track de audio ---
  // ytId = el video de este contenido, si existe y es público. No se usa para
  // reproducir (eso lo hace el mp3, que sí suena en segundo plano) sino para
  // ofrecer el link al canal: así el video igual suma views y suscriptores.
  let track: PlayableTrack | null = null;
  let ytId: string | null = null;
  if (tab === "libro") {
    const v = book.audioVersions.find((x) => x.voiceId === vozEfectiva && ((x.youtubeVideoId && x.youtubePublic) || (x.audioUrl && x.status === "ready")));
    // Preferimos el mp3 propio sobre el embed de YouTube: el <audio> sigue sonando
    // con el teléfono bloqueado (Media Session), el iframe de YouTube no.
    if (v)
      track = v.audioUrl && v.status === "ready"
        ? { title: book.title, author: book.author, slug: book.slug, kind: "audio", src: v.audioUrl, cover: book.coverImageUrl }
        : { title: book.title, author: book.author, slug: book.slug, kind: "youtube", src: v.youtubeVideoId!, cover: book.coverImageUrl };
    if (v?.youtubeVideoId && v.youtubePublic) ytId = v.youtubeVideoId;
  } else if (tab === "sinopsis") {
    const e = book.summary?.[activeLang]?.sinopsis;
    const src = (vozEfectiva && e?.audio?.[vozEfectiva]) ?? e?.audio?.nova ?? e?.audio?.onyx ?? e?.audioUrl;
    if (src) track = { title: `Sinopsis · ${book.title}`, author: book.author, slug: book.slug, kind: "audio", src, cover: book.coverImageUrl };
  } else {
    const e = book.summary?.[activeLang]?.resumen;
    // Igual que arriba: el mp3 gana porque permite escuchar en segundo plano.
    const src = (vozEfectiva && e?.audio?.[vozEfectiva]) ?? e?.audio?.nova ?? e?.audio?.onyx ?? e?.audioUrl;
    if (src) track = { title: `Resumen · ${book.title}`, author: book.author, slug: book.slug, kind: "audio", src, cover: book.coverImageUrl };
    else if (e?.youtubeVideoId && e.youtubePublic) track = { title: `Resumen · ${book.title}`, author: book.author, slug: book.slug, kind: "youtube", src: e.youtubeVideoId, cover: book.coverImageUrl };
    if (e?.youtubeVideoId && e.youtubePublic) ytId = e.youtubeVideoId;
  }

  // En Capa 2 la "sinopsis" es nuestra reseña editorial y el "resumen" el análisis largo.
  const tabLabel: Record<Tab, string> = hasLibro
    ? { libro: "Libro", sinopsis: "Sinopsis", resumen: "Resumen" }
    : { libro: "Libro", sinopsis: "Reseña", resumen: "Análisis" };
  const isOriginal = libroLang === orig;
  // El audiolibro es la narración del texto ORIGINAL. Traducir el texto no traduce
  // el audio: son dos cosas distintas y la web no lo decía. Alguien traducía a
  // español, apretaba play y escuchaba inglés sin entender por qué.
  const audioEnOtroIdioma = tab === "libro" && !isOriginal && !!track;

  if (nothingToShow) return null;

  return (
    <div className="rounded-2xl border border-line bg-surface shadow-sm">
      {/* Pestañas */}
      <div className="flex items-center gap-1 border-b border-line px-2">
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`relative px-4 py-3 text-sm font-semibold tracking-wide uppercase transition ${tab === t ? "text-ink" : "text-ink-soft hover:text-ink"}`}>
            {tabLabel[t]}
            {tab === t && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-accent" />}
          </button>
        ))}
      </div>

      {/* Banderitas de idioma del LIBRO */}
      {tab === "libro" && book.gutenbergId && (
        <div className="flex flex-wrap items-center gap-1.5 px-4 pt-4">
          <LangChip on={isOriginal} onClick={() => setLibroLang(orig)}>
            {flagFor(orig)} {nameFor(orig)}
          </LangChip>
          {/* opción rápida ES/EN */}
          {!manifest.some((l) => l.code === otherLang) && (
            <LangChip on={libroLang === otherLang} loading={busy === otherLang} onClick={() => loadLang(otherLang)}>
              {flagFor(otherLang)} {nameFor(otherLang)}
            </LangChip>
          )}
          {manifest.map((l) => (
            <LangChip key={l.code} on={libroLang === l.code} loading={busy === l.code} onClick={() => loadLang(l.code, l.name)}>
              {flagFor(l.code)} {l.name}
            </LangChip>
          ))}
          {/* Otro idioma */}
          <div className="relative">
            <LangChip on={false} onClick={() => setTransOpen((v) => !v)}>+ Otro idioma</LangChip>
            {transOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setTransOpen(false)} />
                <div className="absolute top-full left-0 z-20 mt-1 w-56 rounded-xl border border-line bg-surface p-2 shadow-xl">
                  <p className="mb-1 px-1 text-xs text-ink-soft">Traducir a…</p>
                  <input value={other} onChange={(e) => setOther(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && translateOther()}
                    placeholder="Ej: Francés, Alemán, Italiano…"
                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent" />
                  <button onClick={translateOther} className="mt-2 w-full rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-dark">
                    Traducir
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Controles */}
      <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
        {tab !== "libro" && summaryLangs.length > 1 && (
          <div className="flex gap-1 rounded-full bg-paper p-1">
            {summaryLangs.map((l) => (
              <Pill key={l} on={activeLang === l} onClick={() => setLang(l)}>{l === "es" ? "🇪🇸 Español" : "🇬🇧 English"}</Pill>
            ))}
          </div>
        )}
        {/* Solo se ofrecen las voces que existen: una pastilla que al tocarla no
            reproduce nada es peor que no mostrarla. */}
        {vocesDisponibles.length > 1 && (
          <div className="flex gap-1 rounded-full bg-paper p-1">
            {vocesDisponibles.map((vc) => (
              <Pill key={vc} on={vozEfectiva === vc} onClick={() => setVoice(vc)}>{vc === "onyx" ? "♂ Onyx" : "♀ Nova"}</Pill>
            ))}
          </div>
        )}
        {track ? (
          <div className="ml-auto flex items-center gap-2">
            <PlayButton track={track} className="inline-flex items-center gap-1.5 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-dark active:scale-95">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
              {audioEnOtroIdioma ? `Escuchar en ${nameFor(orig)}` : "Escuchar"}
            </PlayButton>
            {/* El reproductor usa el mp3 (único que suena con el teléfono bloqueado),
                pero el video sigue accesible: le da views y suscriptores al canal. */}
            {ytId && (
              <a
                href={`https://www.youtube.com/watch?v=${ytId}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Ver este audio como video en nuestro canal"
                className="inline-flex items-center gap-1.5 rounded-full bg-paper px-3.5 py-2.5 text-sm font-semibold text-ink-soft ring-1 ring-line transition hover:text-ink active:scale-95"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="#FF0000" aria-hidden>
                  <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8Z" />
                  <path d="M9.6 15.6 15.8 12 9.6 8.4v7.2Z" fill="#fff" />
                </svg>
                YouTube
              </a>
            )}
          </div>
        ) : (
          <span className="ml-auto rounded-full bg-paper px-3 py-1.5 text-xs font-medium text-ink-soft">🎧 Audio en preparación</span>
        )}
      </div>

      {audioEnOtroIdioma && (
        <p className="px-4 pt-2 text-xs text-ink-soft">
          Estás leyendo la traducción, pero la narración existe solo en{" "}
          {nameFor(orig)}. El <strong>resumen</strong> sí está narrado en español.
        </p>
      )}

      {/* Texto */}
      <div className="px-5 pt-4 pb-5">
        {tab === "libro" ? (
          busy === libroLang ? (
            <div className="py-10 text-center text-sm text-ink-soft">
              🌐 Traduciendo a {manifest.find((l) => l.code === libroLang)?.name ?? nameFor(libroLang)} con IA…
              <br /><span className="text-xs">La primera vez tarda un poco; después queda guardado e instantáneo para todos.</span>
            </div>
          ) : text ? (
            <>
              {!isOriginal && (
                <p className="mb-3 inline-block rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent-dark">
                  🌐 Traducción generada con IA
                </p>
              )}
              <div className="max-h-[28rem] overflow-y-auto pr-2 leading-relaxed whitespace-pre-line text-ink/80">
                {text.slice(0, 14000)}{text.length > 14000 && "…"}
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-sm font-semibold">
                {isOriginal && book.gutenbergId && (
                  <Link href={`/leer/${book.gutenbergId}?t=${encodeURIComponent(book.title)}&a=${encodeURIComponent(book.author)}`} className="text-accent hover:text-accent-dark">
                    Leer completo →
                  </Link>
                )}
                {!isOriginal && book.gutenbergId && (
                  <Link href={`/leer-traduccion/${book.gutenbergId}/${libroLang}?t=${encodeURIComponent(book.title)}`} className="text-accent hover:text-accent-dark">
                    Leer traducción completa →
                  </Link>
                )}
              </div>
            </>
          ) : !book.gutenbergId ? (
            <p className="leading-relaxed text-ink/80">{book.description}</p>
          ) : (
            <p className="py-8 text-center text-sm text-ink-soft">Cargando…</p>
          )
        ) : (
          <p className="leading-relaxed whitespace-pre-line text-ink/80">{(text ?? "").replace(/^["']|["']$/g, "")}</p>
        )}
      </div>
    </div>
  );
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`rounded-full px-3 py-1 text-sm font-medium transition ${on ? "bg-ink text-paper shadow-sm" : "text-ink-soft hover:text-ink"}`}>
      {children}
    </button>
  );
}

function LangChip({ on, onClick, loading, children }: { on: boolean; onClick: () => void; loading?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={loading}
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium transition disabled:opacity-60 ${on ? "bg-ink text-paper shadow-sm" : "bg-paper text-ink-soft ring-1 ring-line hover:text-ink"}`}>
      {loading ? "… " : ""}{children}
    </button>
  );
}
