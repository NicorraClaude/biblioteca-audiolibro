"use client";

import { useEffect, useState } from "react";

type Review = { name: string; rating: number; text: string; at: string };

function Stars({ value, onPick, size = "text-base" }: { value: number; onPick?: (n: number) => void; size?: string }) {
  return (
    <span className={`inline-flex ${size}`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onPick}
          onClick={() => onPick?.(n)}
          className={`${onPick ? "cursor-pointer" : "cursor-default"} ${n <= Math.round(value) ? "text-amber-400" : "text-line"}`}
          aria-label={`${n} estrellas`}
        >
          ★
        </button>
      ))}
    </span>
  );
}

export function Reviews({ id }: { id: string | number }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avg, setAvg] = useState(0);
  const [count, setCount] = useState(0);
  const [rating, setRating] = useState(0);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/reviews/${id}`).then((r) => r.json()).then((j) => {
      setReviews(j.reviews ?? []);
      setAvg(j.avg ?? 0);
      setCount(j.count ?? 0);
    }).catch(() => {});
  }, [id]);

  async function submit() {
    if (!rating || busy) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/reviews/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, name, text }),
      });
      const j = await r.json();
      if (j.ok) {
        setReviews((rs) => [{ name: name || "Anónimo", rating, text, at: new Date().toISOString() }, ...rs]);
        setAvg(j.avg ?? avg);
        setCount(j.count ?? count + 1);
        setSent(true);
        setText("");
        setName("");
        setRating(0);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <h2 className="font-display text-lg font-semibold text-ink">Puntajes y reseñas</h2>
        {count > 0 && (
          <span className="flex items-center gap-1.5 text-sm text-ink-soft">
            <Stars value={avg} /> <strong className="text-ink">{avg}</strong> · {count}
          </span>
        )}
      </div>

      {!sent ? (
        <div className="mb-5 rounded-xl bg-paper p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-sm text-ink-soft">Tu puntaje:</span>
            <Stars value={rating} onPick={setRating} size="text-2xl" />
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            placeholder="Contanos qué te pareció (opcional)…"
            className="mb-2 w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre (opcional)"
              className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <button onClick={submit} disabled={!rating || busy} className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white transition hover:bg-accent-dark disabled:opacity-40">
              {busy ? "Enviando…" : "Enviar"}
            </button>
          </div>
        </div>
      ) : (
        <p className="mb-5 rounded-xl bg-mint/10 px-4 py-3 text-sm text-mint">¡Gracias! Tu reseña ya está publicada.</p>
      )}

      <div className="space-y-3">
        {reviews.length === 0 && <p className="text-sm text-ink-soft">Todavía no hay reseñas. ¡Sé el primero!</p>}
        {reviews.slice(0, 20).map((r, i) => (
          <div key={i} className="border-t border-line pt-3 first:border-0 first:pt-0">
            <div className="flex items-center gap-2">
              <Stars value={r.rating} size="text-sm" />
              <span className="text-sm font-semibold text-ink">{r.name}</span>
            </div>
            {r.text && <p className="mt-1 text-sm leading-relaxed text-ink/80">{r.text}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
