import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Términos del servicio",
  description: "Términos del servicio de Biblioteca Abierta.",
};

export default function TerminosPage() {
  return (
    <article className="prose mx-auto max-w-2xl text-stone-700">
      <h1 className="text-2xl font-black text-stone-900">
        Términos del servicio
      </h1>
      <p className="mt-2 text-sm text-stone-500">
        Última actualización: junio de 2026
      </p>

      <h2 className="mt-6 text-lg font-bold text-stone-900">Uso del sitio</h2>
      <p className="mt-2">
        Biblioteca Abierta ofrece acceso gratuito a audiolibros y e-books de
        dominio público. Podés escuchar, descargar y compartir ese contenido
        libremente.
      </p>

      <h2 className="mt-6 text-lg font-bold text-stone-900">
        Estado legal del contenido
      </h2>
      <p className="mt-2">
        Solo publicamos como audiolibro completo y descarga obras de dominio
        público (fuentes como Project Gutenberg y LibriVox). Para libros con
        derechos vigentes ofrecemos únicamente reseñas originales y enlaces para
        conseguirlos; no reproducimos su texto. Los títulos licenciados se
        publican solo con un acuerdo válido.
      </p>

      <h2 className="mt-6 text-lg font-bold text-stone-900">Enlaces externos</h2>
      <p className="mt-2">
        El sitio puede contener enlaces de afiliado y reproductores de terceros
        (YouTube, Internet Archive). No nos responsabilizamos por el contenido o
        las políticas de esos servicios.
      </p>

      <h2 className="mt-6 text-lg font-bold text-stone-900">Contacto</h2>
      <p className="mt-2">
        Consultas:{" "}
        <a className="text-amber-700 underline" href="mailto:nicorra@gmail.com">
          nicorra@gmail.com
        </a>
        .
      </p>
    </article>
  );
}
