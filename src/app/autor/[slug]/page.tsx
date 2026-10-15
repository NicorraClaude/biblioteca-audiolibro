// Página de autor: "audiolibros de Jane Austen gratis".
//
// Misma lógica que las categorías: capta la búsqueda por nombre de autor, que es
// de las más frecuentes, y enlaza todas sus obras entre sí.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicBooks } from "@/lib/books";
import { GrillaLibros } from "@/components/GrillaLibros";
import { paraTarjeta, hasPlayableAudio } from "@/lib/presentation";
import { SITE, MARCA, autores, breadcrumb, listaDeLibros } from "@/lib/seo";

export const dynamicParams = false;

async function cargar(slug: string) {
  const books = await getPublicBooks();
  return autores(books).find((a) => a.slug === slug) ?? null;
}

export async function generateStaticParams() {
  const books = await getPublicBooks();
  return autores(books).map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const a = await cargar(slug);
  if (!a) return { title: "Autor no encontrado" };
  const title = `${a.nombre}: audiolibros y resúmenes gratis en español`;
  const description =
    `Todas las obras de ${a.nombre} en ${MARCA}: ${a.libros.slice(0, 5).map((b) => b.title).join(", ")}. ` +
    `Audiolibros completos y resúmenes narrados, gratis y sin registro.`;
  return {
    title,
    description,
    alternates: { canonical: `${SITE}/autor/${a.slug}` },
    openGraph: { title, description, url: `${SITE}/autor/${a.slug}`, siteName: MARCA, type: "profile", locale: "es_AR" },
  };
}

export default async function AutorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = await cargar(slug);
  if (!a) notFound();

  const libros = [...a.libros].sort(
    (x, y) => Number(hasPlayableAudio(y)) - Number(hasPlayableAudio(x)) || (y.downloadCount ?? 0) - (x.downloadCount ?? 0),
  );
  const cats = [...new Set(libros.flatMap((b) => b.categories ?? []))].slice(0, 8);

  return (
    <div>
      <script
        type="application/ld+json"
         
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            breadcrumb([
              { nombre: "Inicio", url: SITE },
              { nombre: a.nombre, url: `${SITE}/autor/${a.slug}` },
            ]),
            {
              "@context": "https://schema.org",
              "@type": "Person",
              name: a.nombre,
              url: `${SITE}/autor/${a.slug}`,
            },
            listaDeLibros(libros, `Obras de ${a.nombre}`),
          ]),
        }}
      />

      <nav className="mb-4 text-sm text-ink-soft">
        <Link href="/" className="hover:text-ink">Inicio</Link> <span className="px-1">/</span>
        <span className="text-ink">{a.nombre}</span>
      </nav>

      <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        {a.nombre}: audiolibros y resúmenes gratis
      </h1>
      <p className="mt-3 max-w-2xl text-ink-soft">
        {libros.length} obras de {a.nombre} para escuchar y leer sin costo en {MARCA}.
        {cats.length ? ` Temas: ${cats.join(", ").toLowerCase()}.` : ""}
      </p>

      <div className="mt-8">
        <GrillaLibros libros={libros.map(paraTarjeta)} />
      </div>
    </div>
  );
}
