import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: "Política de privacidad de Biblioteca Abierta.",
};

export default function PrivacidadPage() {
  return (
    <article className="prose mx-auto max-w-2xl text-stone-700">
      <h1 className="text-2xl font-black text-stone-900">
        Política de privacidad
      </h1>
      <p className="mt-2 text-sm text-stone-500">
        Última actualización: junio de 2026
      </p>

      <h2 className="mt-6 text-lg font-bold text-stone-900">Qué somos</h2>
      <p className="mt-2">
        Biblioteca Abierta es una biblioteca web de audiolibros y e-books de
        dominio público. El acceso es libre y gratuito.
      </p>

      <h2 className="mt-6 text-lg font-bold text-stone-900">
        Datos personales
      </h2>
      <p className="mt-2">
        No requerimos registro ni cuenta para usar el sitio. No recopilamos,
        almacenamos ni vendemos datos personales de los visitantes. No usamos
        cookies de seguimiento ni perfiles publicitarios.
      </p>

      <h2 className="mt-6 text-lg font-bold text-stone-900">
        Contenido de terceros
      </h2>
      <p className="mt-2">
        Algunas páginas embeben reproductores de YouTube, de Internet Archive
        (archive.org) o enlazan a tiendas (links de afiliado). Esos servicios
        tienen sus propias políticas de privacidad cuando reproducís o visitás
        su contenido.
      </p>

      <h2 className="mt-6 text-lg font-bold text-stone-900">
        Uso de la API de YouTube
      </h2>
      <p className="mt-2">
        Para publicar nuestras propias narraciones de obras de dominio público
        en nuestro canal de YouTube, usamos los Servicios de la API de YouTube.
        Al hacerlo cumplimos con los{" "}
        <a
          className="text-amber-700 underline"
          href="https://www.youtube.com/t/terms"
          target="_blank"
          rel="noopener noreferrer"
        >
          Términos de Servicio de YouTube
        </a>{" "}
        y con la{" "}
        <a
          className="text-amber-700 underline"
          href="https://policies.google.com/privacy"
          target="_blank"
          rel="noopener noreferrer"
        >
          Política de Privacidad de Google
        </a>
        . Solo publicamos contenido propio; no accedemos a datos de cuentas ni
        de videos de terceros.
      </p>

      <h2 className="mt-6 text-lg font-bold text-stone-900">
        Manejo y eliminación de datos
      </h2>
      <p className="mt-2">
        No almacenamos datos de usuarios obtenidos a través de los Servicios de
        la API de YouTube. La autorización de la API se usa exclusivamente para
        que el operador publique sus propios videos en su propio canal. Podés
        revocar el acceso de esta aplicación en cualquier momento desde la página
        de{" "}
        <a
          className="text-amber-700 underline"
          href="https://security.google.com/settings/security/permissions"
          target="_blank"
          rel="noopener noreferrer"
        >
          permisos de tu cuenta de Google
        </a>
        . Cualquier dato técnico transitorio se elimina una vez completada la
        publicación. Para solicitar la eliminación de datos, escribinos al correo
        de contacto.
      </p>

      <h2 className="mt-6 text-lg font-bold text-stone-900">Contacto</h2>
      <p className="mt-2">
        Por consultas sobre esta política, escribinos a{" "}
        <a className="text-amber-700 underline" href="mailto:nicorra@gmail.com">
          nicorra@gmail.com
        </a>
        .
      </p>
    </article>
  );
}
