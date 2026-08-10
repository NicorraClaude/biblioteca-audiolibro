import type { Book } from "@/lib/types";

// Tapas DISEÑADAS, originales y variadas (sin imágenes externas ni marca de
// terceros). Cada libro recibe, de forma estable por su slug, una paleta + una
// de varias plantillas tipográficas estilo edición de colección.

type Palette = { bg: string; deep: string; ink: string; accent: string };

// Paletas sobrias y "editoriales" (fondo profundo, tinta crema, dorado/acento).
const PALETTES: Palette[] = [
  { bg: "#3b241a", deep: "#27160f", ink: "#f1e4d0", accent: "#c89b5c" }, // cuero
  { bg: "#1e3a32", deep: "#13241f", ink: "#ede7d4", accent: "#cb9d63" }, // bosque
  { bg: "#2a2440", deep: "#1a1630", ink: "#e9e3f1", accent: "#b89bdc" }, // ciruela
  { bg: "#10314a", deep: "#0a2030", ink: "#e3ecf2", accent: "#7fb3d3" }, // océano
  { bg: "#4a1d22", deep: "#321217", ink: "#f3e2dc", accent: "#d89a86" }, // vino
  { bg: "#1f3d3d", deep: "#132727", ink: "#e6eeea", accent: "#6fc2b3" }, // teal
  { bg: "#402a14", deep: "#2a1b0c", ink: "#f1e6cf", accent: "#d8a94f" }, // bronce
  { bg: "#33203a", deep: "#211428", ink: "#efe2f0", accent: "#cf8fb6" }, // berenjena
  { bg: "#1b2f4a", deep: "#101f33", ink: "#e4eaf2", accent: "#8aa6cc" }, // medianoche
  { bg: "#3c3122", deep: "#271f14", ink: "#f0e9d8", accent: "#bfa46b" }, // pergamino oscuro
  { bg: "#43202e", deep: "#2c121d", ink: "#f2e1e6", accent: "#d291a3" }, // borgoña
  { bg: "#23383a", deep: "#162425", ink: "#e7eeec", accent: "#7ab0a4" }, // pino
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function initials(title: string): string {
  const words = title.replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/).filter(Boolean);
  return (words.slice(0, 2).map((w) => w[0]).join("") || title[0] || "B").toUpperCase();
}

// Pequeños ornamentos SVG reutilizables.
function Rule({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 100 8" className="h-2 w-full" preserveAspectRatio="none" aria-hidden>
      <line x1="2" y1="4" x2="42" y2="4" stroke={color} strokeWidth="1" />
      <line x1="58" y1="4" x2="98" y2="4" stroke={color} strokeWidth="1" />
      <path d="M50 1 L53 4 L50 7 L47 4 Z" fill={color} />
    </svg>
  );
}

function Flourish({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 40 16" className="h-4 w-10" aria-hidden>
      <path d="M2 8 C 10 2, 14 2, 20 8 C 26 14, 30 14, 38 8" fill="none" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="20" cy="8" r="1.6" fill={color} />
    </svg>
  );
}

export function Cover({ book, variant = "card" }: { book: Book; variant?: "card" | "detail" }) {
  const detail = variant === "detail";

  // Portada REAL (Open Library, sin marca de fuentes). Se muestra COMPLETA
  // (object-contain) centrada sobre un passe-partout oscuro, para que ninguna
  // quede cortada y todas conserven el mismo encuadre 2:3, como en una vitrina.
  if (book.coverImageUrl) {
    const pal = PALETTES[hash(book.slug) % PALETTES.length];
    return (
      <div
        className="flex h-full w-full items-center justify-center overflow-hidden"
        style={{ background: `radial-gradient(120% 100% at 50% 0%, ${pal.deep}, #0c0a08)` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={book.coverImageUrl}
          alt={`Tapa de ${book.title}`}
          loading="lazy"
          className="max-h-full max-w-full object-contain shadow-lg"
        />
      </div>
    );
  }

  // Si no hay portada real, una tapa DISEÑADA (fallback, siempre correcta).
  const h = hash(book.slug);
  const p = PALETTES[h % PALETTES.length];
  const tpl = Math.floor(h / 16) % 4;

  const titleCls = detail
    ? "font-display font-semibold leading-tight text-balance text-[1.7rem] sm:text-[2rem]"
    : "font-display font-semibold leading-[1.12] text-balance text-[1.05rem] line-clamp-5";
  const authorCls = detail ? "text-[0.8rem]" : "text-[0.62rem]";
  const pad = detail ? "p-7" : "p-4";
  const imprint = detail ? "text-[0.6rem]" : "text-[0.5rem]";

  // Fondo común: degradé sutil del color profundo al base + viñeta.
  const Frame = ({ children }: { children: React.ReactNode }) => (
    <div
      className={`relative flex h-full w-full flex-col overflow-hidden ${pad}`}
      style={{ background: `radial-gradient(120% 100% at 50% 0%, ${p.bg}, ${p.deep})`, color: p.ink }}
    >
      <div className="pointer-events-none absolute inset-0" style={{ boxShadow: `inset 0 0 60px ${p.deep}` }} />
      {children}
      <span className={`absolute inset-x-0 bottom-2.5 text-center ${imprint} tracking-[0.3em] uppercase`} style={{ color: p.accent, opacity: 0.85 }}>
        Biblioteca Abierta
      </span>
    </div>
  );

  // Plantilla 0 — Clásico enmarcado (doble filete + ornamento)
  if (tpl === 0) {
    return (
      <Frame>
        <div className="absolute inset-3 rounded-[2px]" style={{ border: `1px solid ${p.accent}`, opacity: 0.55 }} />
        <div className="absolute inset-[14px] rounded-[1px]" style={{ border: `1px solid ${p.accent}`, opacity: 0.3 }} />
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center text-center">
          <Flourish color={p.accent} />
          <h3 className={`mt-3 ${titleCls}`}>{book.title}</h3>
          <div className="my-3 w-1/2"><Rule color={p.accent} /></div>
          <p className={`${authorCls} tracking-[0.18em] uppercase`} style={{ color: p.accent }}>{book.author}</p>
        </div>
      </Frame>
    );
  }

  // Plantilla 1 — Bandas (estilo colección): banda superior e inferior
  if (tpl === 1) {
    return (
      <Frame>
        <div className="relative z-10 flex flex-1 flex-col">
          <div className="flex items-center gap-2" style={{ color: p.accent }}>
            <span className="h-px flex-1" style={{ background: p.accent, opacity: 0.6 }} />
            <span className={`${imprint} tracking-[0.25em] uppercase`}>
              {book.contentLayer === 1 ? "Clásico" : "Análisis"}
            </span>
            <span className="h-px flex-1" style={{ background: p.accent, opacity: 0.6 }} />
          </div>
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <h3 className={titleCls}>{book.title}</h3>
          </div>
          <div className="text-center">
            <div className="mx-auto mb-2 w-2/3"><Rule color={p.accent} /></div>
            <p className={`${authorCls} tracking-[0.2em] uppercase`} style={{ color: p.accent }}>{book.author}</p>
          </div>
        </div>
      </Frame>
    );
  }

  // Plantilla 2 — Monograma (inicial grande de fondo + título abajo)
  if (tpl === 2) {
    return (
      <Frame>
        <span
          className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 font-display font-black leading-none select-none"
          style={{ fontSize: detail ? "15rem" : "8.5rem", color: p.accent, opacity: 0.12 }}
          aria-hidden
        >
          {initials(book.title)}
        </span>
        <div className="relative z-10 mt-auto">
          <div className="mb-3 w-10"><Rule color={p.accent} /></div>
          <h3 className={titleCls}>{book.title}</h3>
          <p className={`mt-2 ${authorCls} tracking-[0.18em] uppercase`} style={{ color: p.accent }}>{book.author}</p>
        </div>
      </Frame>
    );
  }

  // Plantilla 3 — Geométrico (arcos concéntricos como sol naciente + plaqueta)
  return (
    <Frame>
      <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMin slice" aria-hidden>
        {[40, 32, 24, 16].map((r) => (
          <circle key={r} cx="50" cy="6" r={r} fill="none" stroke={p.accent} strokeWidth="0.5" opacity="0.35" />
        ))}
      </svg>
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center text-center">
        <div className="mb-3"><Flourish color={p.accent} /></div>
        <h3 className={titleCls}>{book.title}</h3>
        <div className="my-3 w-1/3"><Rule color={p.accent} /></div>
        <p className={`${authorCls} tracking-[0.18em] uppercase`} style={{ color: p.accent }}>{book.author}</p>
      </div>
    </Frame>
  );
}
