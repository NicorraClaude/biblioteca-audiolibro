"use client";

import { useState } from "react";

// "Enviar a Kindle" — guía al usuario a llevar el e-book a su Kindle.
// (Kindle acepta EPUB vía "Send to Kindle". Descarga + subida en 2 pasos.)
export function EnviarKindle({ downloadUrl }: { downloadUrl: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-5 py-3 font-semibold text-ink transition hover:bg-paper active:scale-95"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="5" y="2.5" width="14" height="19" rx="2" />
          <path d="M9 18.5h6" strokeLinecap="round" />
        </svg>
        Enviar a Kindle
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 z-30 mb-2 w-72 rounded-2xl border border-line bg-surface p-4 shadow-xl">
            <p className="text-sm font-semibold text-ink">En 2 pasos:</p>
            <ol className="mt-2 space-y-2 text-sm text-ink-soft">
              <li>
                <a
                  href={downloadUrl}
                  className="font-semibold text-accent hover:text-accent-dark"
                >
                  1. Descargá el e-book ↓
                </a>
              </li>
              <li>
                2. Reenvialo desde tu mail a tu dirección{" "}
                <span className="font-semibold text-ink">@kindle.com</span> y te llega al Kindle.
              </li>
            </ol>
            <p className="mt-3 text-xs text-ink-soft/80">
              Tu dirección @kindle.com está en la app Kindle, en Ajustes → Tu cuenta.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
