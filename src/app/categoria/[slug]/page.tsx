// Página de categoría: "audiolibros de misterio gratis en español".
//
// POR QUÉ EXISTE. Hasta ahora el sitio tenía la home y 853 fichas, y nada en el
// medio. Las búsquedas por categoría ("audiolibros de terror gratis") no tenían
// ninguna página a la que llegar, y además Google descubre las fichas siguiendo
// enlaces: sin estas páginas, cada ficha colgaba solo del catálogo de la home.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicBooks } from "@/lib/books";
import { GrillaLibros } from "@/components/GrillaLibros";
import { paraTarjeta, hasPlayableAudio } from "@/lib/presentation";
import { SITE, MARCA, breadcrumb, categorias, listaDeLibros } from "@/lib/seo";

export const dynamicParams = false;

async function cargar(slug: string) {
  const books = await getPublicBooks();
  const grupo = categorias(books).find((c) => c.slug === slug);
  return grupo ?? null;
}

export async function generateStaticParams() {
  const books = await getPublicBooks();
  return categorias(books).map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const g = await cargar(slug);
  if (!g) return { title: "Categoría no encontrada" };
  const title = `Audiolibros de ${g.nombre.toLowerCase()} gratis en español (${g.libros.length})`;
  const description =
    `${g.libros.length} audiolibros y resúmenes de ${g.nombre.toLowerCase()} para escuchar gratis, sin registro: ` +
    `${g.libros.slice(0, 4).map((b) => b.title).join(", ")} y más. Audio y texto completos en ${MARCA}.`;
  return {
    title,
    description,
    alternates: { canonical: `${SITE}/categoria/${g.slug}` },
    openGraph: { title, description, url: `${SITE}/categoria/${g.slug}`, siteName: MARCA, type: "website", locale: "es_AR" },
  };
}

export default async function CategoriaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const g = await cargar(slug);
  if (!g) notFound();

  const libros = [...g.libros].sort(
    (a, b) => Number(hasPlayableAudio(b)) - Number(hasPlayableAudio(a)) || (b.downloadCount ?? 0) - (a.downloadCount ?? 0),
  );
  const conAudio = libros.filter(hasPlayableAudio).length;
  const otras = categorias(await getPublicBooks()).filter((c) => c.slug !== g.slug).slice(0, 14);

  return (
    <div>
      <script
        type="application/ld+json"
         
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            breadcrumb([
              { nombre: "Inicio", url: SITE },
              { nombre: g.nombre, url: `${SITE}/categoria/${g.slug}` },
            ]),
            listaDeLibros(libros, `Audiolibros de ${g.nombre}`),
          ]),
        }}
      />

      <nav className="mb-4 text-sm text-ink-soft">
        <Link href="/" className="hover:text-ink">Inicio</Link> <span className="px-1">/</span>
        <span className="text-ink">{g.nombre}</span>
      </nav>

      <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        Audiolibros de {g.nombre.toLowerCase()}, gratis
      </h1>
      <p className="mt-3 max-w-2xl text-ink-soft">
        {libros.length} títulos de {g.nombre.toLowerCase()} en {MARCA}, {conAudio} ya listos para escuchar.
        Son obras de dominio público y resúmenes propios: se escuchan y se leen sin pagar, sin registro y sin
        aviso publicitario en el medio.
      </p>

      <div className="mt-8">
        <GrillaLibros libros={libros.map(paraTarjeta)} />
      </div>

      <section className="mt-14 border-t border-black/5 pt-8">
        <h2 className="mb-4 font-display text-xl font-semibold">Otras categorías</h2>
        <div className="flex flex-wrap gap-2">
          {otras.map((c) => (
            <Link
              key={c.slug}
              href={`/categoria/${c.slug}`}
              className="rounded-full bg-black/5 px-3 py-1.5 text-sm text-ink-soft transition hover:bg-black/10 hover:text-ink"
            >
              {c.nombre} <span className="opacity-60">{c.libros.length}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
