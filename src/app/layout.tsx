import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://biblioteca-audiolibros.vercel.app"),
  title: {
    default: "Audiolibros gratis — La biblioteca abierta",
    template: "%s · Audiolibros gratis",
  },
  description:
    "Audiolibros y e-books gratuitos de dominio público, en español e inglés. Escuchá y descargá clásicos de la literatura, legal y sin costo.",
  keywords: [
    "audiolibros gratis",
    "dominio público",
    "ebooks gratis",
    "clásicos",
    "literatura",
    "audiolibros en español",
  ],
  openGraph: {
    type: "website",
    locale: "es_AR",
    title: "Audiolibros gratis — La biblioteca abierta",
    description:
      "Clásicos de la literatura en audiolibro y e-book, gratis y legales.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className="h-full">
      <body className="flex min-h-full flex-col bg-stone-50 text-stone-900 antialiased">
        <header className="sticky top-0 z-10 border-b border-stone-200 bg-stone-50/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl">📚</span>
              <span className="text-lg font-bold tracking-tight">
                Biblioteca Abierta
              </span>
            </Link>
            <span className="hidden text-sm text-stone-500 sm:block">
              Audiolibros y e-books · gratis y legales
            </span>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
          {children}
        </main>

        <footer className="border-t border-stone-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-stone-500">
            <p>
              Contenido de dominio público (Project Gutenberg, LibriVox) y
              reseñas originales. Cada título indica su estado legal.
            </p>
            <p className="mt-1">
              © {new Date().getFullYear()} Biblioteca Abierta.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
