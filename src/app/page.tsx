import { getPublicBooks } from "@/lib/books";
import { Catalog } from "@/components/Catalog";

export default async function HomePage() {
  const books = await getPublicBooks();

  const layer1 = books.filter((b) => b.contentLayer === 1).length;

  return (
    <div>
      {/* Hero */}
      <section className="mb-8 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 px-6 py-10 text-white shadow-sm sm:px-10 sm:py-14">
        <h1 className="max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">
          Miles de audiolibros y e-books, gratis y legales.
        </h1>
        <p className="mt-3 max-w-xl text-amber-50">
          Clásicos de la literatura en español e inglés, para escuchar y
          descargar sin costo. Empezamos con {layer1} obras de dominio público y
          sumamos más cada semana.
        </p>
        <a
          href="#catalogo"
          className="mt-6 inline-block rounded-lg bg-white px-5 py-2.5 font-semibold text-orange-600 shadow-sm transition hover:bg-amber-50"
        >
          Explorar el catálogo ↓
        </a>
      </section>

      {/* Catálogo */}
      <section id="catalogo" className="scroll-mt-20">
        <h2 className="mb-4 text-xl font-bold text-stone-900">Catálogo</h2>
        <Catalog books={books} />
      </section>
    </div>
  );
}
