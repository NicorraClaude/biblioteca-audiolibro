"use client";

import { useState } from "react";

export function SolicitarTitulo() {
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    setErr("");
    if (!title.trim()) {
      setErr("Escribí el título que buscás.");
      return;
    }
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setErr("Ese mail no parece válido (o dejalo vacío).");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/solicitar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, email }),
      });
      if ((await r.json()).ok) setSent(true);
      else setErr("No pudimos registrarlo. Probá de nuevo.");
    } catch {
      setErr("No pudimos registrarlo. Probá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-accent/20 bg-accent-soft/40 p-5 sm:p-6">
      {sent ? (
        <div className="text-center">
          <p className="text-2xl">📚✨</p>
          <p className="mt-2 font-display text-lg font-semibold text-ink">¡Listo! Ya lo estamos generando.</p>
          <p className="mt-1 text-sm text-ink-soft">Volvé a buscarlo acá en un par de horas y va a estar completo —libro, sinopsis y resumen, en español e inglés, con audio.</p>
        </div>
      ) : (
        <>
          <p className="font-display text-lg font-semibold text-ink">¿No encontraste el título que buscás?</p>
          <p className="mt-1 text-sm text-ink-soft">
            Nosotros lo buscamos y lo generamos por vos —libro, sinopsis y resumen, en español e inglés, con audio—.
            Dejanos el título y, en un par de horas, volvé a buscarlo acá: va a estar listo.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título (y autor si lo sabés)"
              className="flex-1 rounded-full border border-line bg-surface px-4 py-2.5 text-sm outline-none focus:border-accent"
            />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              type="email"
              placeholder="Tu mail (opcional)"
              className="rounded-full border border-line bg-surface px-4 py-2.5 text-sm outline-none focus:border-accent sm:w-56"
            />
            <button onClick={submit} disabled={busy} className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-dark disabled:opacity-50">
              {busy ? "Enviando…" : "Buscámelo"}
            </button>
          </div>
          {err && <p className="mt-2 text-xs text-red-500">{err}</p>}
        </>
      )}
    </div>
  );
}
