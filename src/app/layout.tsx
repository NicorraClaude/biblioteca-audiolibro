import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import Link from "next/link";
import { PlayerProvider } from "@/components/player/Player";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["400", "500", "600", "700", "900"],
});
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  metadataBase: new URL("https://biblioteca-audiolibros.vercel.app"),
  title: {
    default: "Biblioteca Abierta — Audiolibros gratis",
    template: "%s · Biblioteca Abierta",
  },
  description:
    "Audiolibros y e-books gratuitos de dominio público, en español e inglés. Escuchá y descargá clásicos, legal y sin costo.",
  keywords: [
    "audiolibros gratis",
    "dominio público",
    "ebooks gratis",
    "clásicos",
    "audiolibros en español",
  ],
  openGraph: {
    type: "website",
    locale: "es_AR",
    title: "Biblioteca Abierta — Audiolibros gratis",
    description: "Clásicos en audiolibro y e-book, gratis y legales.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      className={`${fraunces.variable} ${inter.variable} h-full`}
    >
      <body className="flex min-h-full flex-col bg-paper font-sans text-ink antialiased">
       <PlayerProvider>
        <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
            <Link href="/" className="group flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-lg text-white shadow-sm transition group-hover:scale-105">
                ◐
              </span>
              <span className="font-display text-xl font-semibold tracking-tight">
                Biblioteca Abierta
              </span>
            </Link>
            <Link
              href="/#catalogo"
              className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper transition hover:bg-ink/90 active:scale-95"
            >
              Explorar
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-28 sm:px-6">
          {children}
        </main>

        <footer className="mt-10 border-t border-line bg-surface/60">
          <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-ink-soft sm:px-6">
            <p className="max-w-xl">
              Audiolibros y e-books de dominio público y reseñas originales. Cada
              título indica su estado legal.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
              <span>© {new Date().getFullYear()} Biblioteca Abierta</span>
              <Link href="/privacidad" className="underline-offset-2 hover:underline">
                Privacidad
              </Link>
              <Link href="/terminos" className="underline-offset-2 hover:underline">
                Términos
              </Link>
              <span className="flex items-center gap-1.5 text-xs text-ink-soft/80">
                Audio vía
                <svg viewBox="0 0 90 20" className="h-4 w-auto" role="img" aria-label="YouTube">
                  <path
                    d="M27.97 3.13a3.6 3.6 0 0 0-2.53-2.54C23.2 0 14.27 0 14.27 0S5.34 0 3.1.59A3.6 3.6 0 0 0 .57 3.13C0 5.37 0 10.04 0 10.04s0 4.67.57 6.91a3.6 3.6 0 0 0 2.53 2.54c2.24.59 11.17.59 11.17.59s8.93 0 11.17-.59a3.6 3.6 0 0 0 2.53-2.54c.57-2.24.57-6.91.57-6.91s0-4.67-.57-6.91Z"
                    fill="#FF0000"
                  />
                  <path d="M11.43 14.34 18.86 10l-7.43-4.34v8.68Z" fill="#fff" />
                  <text x="33" y="14" fill="currentColor" fontSize="13" fontWeight="700" fontFamily="Arial, sans-serif">
                    YouTube
                  </text>
                </svg>
                e Internet Archive.
              </span>
            </div>
          </div>
        </footer>
       </PlayerProvider>
      </body>
    </html>
  );
}
