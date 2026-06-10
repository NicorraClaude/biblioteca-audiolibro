import { getPublicBooks } from "@/lib/books";
import { Catalog } from "@/components/Catalog";
import { SolicitarTitulo } from "@/components/SolicitarTitulo";
import { hasPlayableAudio } from "@/lib/presentation";

export default async function HomePage() {
  const books = await getPublicBooks();
  const total = books.length;
  const conAudio = books.filter(hasPlayableAudio).length;

  return (
    <div>
      {/* Hero */}
      <section className="relative mb-10 overflow-hidden rounded-[1.75rem] bg-ink px-6 py-12 text-paper sm:px-12 sm:py-16">
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background:
              "radial-gradient(40rem 30rem at 85% 10%, rgba(236,90,54,0.55), transparent 60%), radial-gradient(30rem 30rem at 0% 100%, rgba(15,157,143,0.4), transparent 60%)",
          }}
        />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium tracking-wide text-paper/80 ring-1 ring-white/15 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" /> {conAudio} ya
            disponibles para escuchar
          </span>
          <h1 className="mt-5 max-w-3xl font-display text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-6xl">
            Tu biblioteca de audiolibros, gratis y para siempre.
          </h1>
          <p className="mt-4 max-w-xl text-base text-paper/70 sm:text-lg">
            Clásicos en español e inglés para escuchar y descargar sin costo, sin
            registro y sin vueltas. {total} títulos y sumando.
          </p>
          <a
            href="#catalogo"
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 font-semibold text-white shadow-lg shadow-accent/30 transition hover:bg-accent-dark active:scale-95"
          >
            Explorar la biblioteca
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>
      </section>

      <section id="catalogo" className="scroll-mt-24">
        <Catalog books={books} />
      </section>

      <section className="mt-12">
        <SolicitarTitulo />
      </section>
    </div>
  );
}
