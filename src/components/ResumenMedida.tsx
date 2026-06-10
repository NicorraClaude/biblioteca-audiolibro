"use client";

import { useState } from "react";
import { PlayButton } from "@/components/player/Player";

type Ctx = { title: string; author: string; slug: string; description?: string; sinopsis?: string; resumen?: string };

const AGES = [
  { v: "niños", l: "Niños" },
  { v: "adolescentes", l: "Adolescentes" },
  { v: "adultos", l: "Adultos" },
];
const DURS = [
  { v: "corto", l: "Corto (~1 min)" },
  { v: "medio", l: "Medio (~3 min)" },
  { v: "largo", l: "Largo (~7 min)" },
];
const FORMATS = [
  { v: "corrido", l: "Texto corrido" },
  { v: "bullets", l: "En bullets" },
];

export function ResumenMedida({ id, ctx }: { id: string | number; ctx: Ctx }) {
  const [open, setOpen] = useState(false);
  const [free, setFree] = useState("");
  const [age, setAge] = useState<string | null>(null);
  const [duration, setDuration] = useState<string | null>("medio");
  const [format, setFormat] = useState<string | null>("corrido");
  const [characters, setCharacters] = useState(false);
  const [lang, setLang] = useState<"es" | "en">("es");
  const [voice, setVoice] = useState<"onyx" | "nova">("onyx");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ text: string; audioUrl: string | null } | null>(null);

  async function generate() {
    setBusy(true);
    setResult(null);
    try {
      const r = await fetch(`/api/resumen-medida/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ free, age, duration, format, characters, lang, voice, audio: true, context: ctx }),
      });
      const j = await r.json();
      setResult({ text: j.text ?? "", audioUrl: j.audioUrl ?? null });
    } catch {
      setResult({ text: "No pudimos generarlo ahora. Probá de nuevo.", audioUrl: null });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-surface shadow-sm">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 px-5 py-4 text-left">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent-soft text-lg">✨</span>
        <span className="min-w-0 flex-1">
          <span className="block font-display font-semibold text-ink">Resumen a medida</span>
          <span className="block text-xs text-ink-soft">Lo generamos como lo necesites — texto y audio — con IA</span>
        </span>
        <svg viewBox="0 0 24 24" className={`h-5 w-5 shrink-0 text-ink-soft transition ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="space-y-4 border-t border-line px-5 pt-4 pb-5">
          <Field label="Edad / público">
            <Chips options={AGES} value={age} onChange={setAge} />
          </Field>
          <Field label="Duración">
            <Chips options={DURS} value={duration} onChange={setDuration} />
          </Field>
          <Field label="Forma">
            <Chips options={FORMATS} value={format} onChange={setFormat} />
          </Field>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-ink/80">
              <input type="checkbox" checked={characters} onChange={(e) => setCharacters(e.target.checked)} className="h-4 w-4 accent-accent" />
              Enfocado en los personajes
            </label>
            <Field label="Idioma" inline>
              <Chips options={[{ v: "es", l: "🇪🇸 ES" }, { v: "en", l: "🇬🇧 EN" }]} value={lang} onChange={(v) => setLang(v as "es" | "en")} required />
            </Field>
            <Field label="Voz" inline>
              <Chips options={[{ v: "onyx", l: "♂ Onyx" }, { v: "nova", l: "♀ Nova" }]} value={voice} onChange={(v) => setVoice(v as "onyx" | "nova")} required />
            </Field>
          </div>
          <Field label="O describílo con tus palabras (opcional)">
            <textarea
              value={free}
              onChange={(e) => setFree(e.target.value)}
              rows={2}
              placeholder="Ej: contame solo el conflicto central y por qué importa, con tono divertido…"
              className="w-full resize-none rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </Field>

          <button onClick={generate} disabled={busy} className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-dark disabled:opacity-50">
            {busy ? "Generando con IA…" : "✨ Generar resumen"}
          </button>

          {busy && <p className="text-xs text-ink-soft">La primera vez tarda unos segundos (texto + audio). Después queda guardado e instantáneo para todos.</p>}

          {result && (
            <div className="rounded-xl bg-paper p-4">
              <div className="mb-3 flex items-center gap-3">
                {result.audioUrl && (
                  <PlayButton
                    track={{ title: `Resumen a medida · ${ctx.title}`, author: ctx.author, slug: ctx.slug, kind: "audio", src: result.audioUrl }}
                    className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                    Escuchar
                  </PlayButton>
                )}
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-line text-ink/85">{result.text}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children, inline }: { label: string; children: React.ReactNode; inline?: boolean }) {
  return (
    <div className={inline ? "" : "space-y-1.5"}>
      <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">{label}</p>
      <div className={inline ? "mt-1.5" : ""}>{children}</div>
    </div>
  );
}

function Chips({ options, value, onChange, required }: { options: { v: string; l: string }[]; value: string | null; onChange: (v: string) => void; required?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(!required && value === o.v ? (null as unknown as string) : o.v)}
          className={`rounded-full px-3 py-1 text-sm font-medium transition ${value === o.v ? "bg-ink text-paper shadow-sm" : "bg-paper text-ink-soft ring-1 ring-line hover:text-ink"}`}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}
