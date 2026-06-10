"use client";

import { useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };
type Ctx = { title: string; author: string; description?: string; sinopsis?: string; resumen?: string };

const SUGS = [
  "¿De qué trata sin spoilers?",
  "Recomendame libros parecidos",
  "¿Quién es el personaje principal?",
  "Compará su final con otra obra del autor",
];

export function ChatLibro({ id, ctx }: { id: string | number; ctx: Ctx }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const next = [...msgs, { role: "user" as const, content: q }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    try {
      const r = await fetch(`/api/chat/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, context: ctx }),
      });
      const j = await r.json();
      setMsgs((m) => [...m, { role: "assistant", content: j.reply ?? "Uy, no pude responder. Probá de nuevo." }]);
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: "Hubo un error. Probá de nuevo en un ratito." }]);
    } finally {
      setBusy(false);
      requestAnimationFrame(() => boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight }));
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-surface shadow-sm">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 px-5 py-4 text-left">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent-soft text-lg">💬</span>
        <span className="min-w-0 flex-1">
          <span className="block font-display font-semibold text-ink">Charlá con el libro</span>
          <span className="block text-xs text-ink-soft">Preguntá, pedí búsquedas, recomendaciones, comparaciones, opiniones…</span>
        </span>
        <svg viewBox="0 0 24 24" className={`h-5 w-5 shrink-0 text-ink-soft transition ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-line px-4 pb-4">
          <div ref={boxRef} className="max-h-80 space-y-3 overflow-y-auto py-4">
            {msgs.length === 0 && (
              <div className="space-y-2">
                <p className="px-1 text-sm text-ink-soft">Probá con algo como:</p>
                <div className="flex flex-wrap gap-2">
                  {SUGS.map((s) => (
                    <button key={s} onClick={() => send(s)} className="rounded-full bg-paper px-3 py-1.5 text-xs text-ink-soft ring-1 ring-line transition hover:text-ink">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-line ${m.role === "user" ? "bg-ink text-paper" : "bg-paper text-ink/90"}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {busy && <div className="flex justify-start"><div className="rounded-2xl bg-paper px-4 py-2.5 text-sm text-ink-soft">escribiendo…</div></div>}
          </div>
          <div className="flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send(input)}
              placeholder="Escribí tu pregunta…"
              className="flex-1 rounded-full border border-line bg-paper px-4 py-2.5 text-sm outline-none focus:border-accent"
            />
            <button onClick={() => send(input)} disabled={busy || !input.trim()} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-white transition hover:bg-accent-dark disabled:opacity-40">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M3 11l18-8-8 18-2-7-8-3z" /></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
