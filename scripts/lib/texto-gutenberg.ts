// Baja el texto de un libro de Gutenberg de forma resistente, y lo CACHEA en R2.
//
// POR QUÉ EXISTE. gutenberg.org devuelve 503/504 cuando se lo consulta seguido, y
// nuestros motores lo consultan mucho: el mismo libro se baja para narrarlo, para
// traducirlo y para narrar la traducción. Con una sola fuente, una tarde de trabajo
// nuestro se convierte en un bloqueo y las corridas fallan sin razón aparente.
//
// Dos defensas:
//   1. Espejos oficiales. Probado en vivo: cuando gutenberg.org daba 503, pglaf y
//      xmission devolvieron el libro entero sin chistar.
//   2. Caché en R2. La primera vez que se baja un libro queda guardado; las demás
//      veces no se toca Gutenberg. Además de ser más rápido, es no abusar de un
//      servicio gratuito del que depende todo el proyecto.
import { r2Put, r2GetText } from "../../src/lib/r2";
import { fetchRetry } from "../db";

// Los espejos usan la ruta "explotada": 2641 → /2/6/4/2641/2641-0.txt
function rutaEspejo(id: number): string {
  const s = String(id);
  const dirs = s.length === 1 ? "0" : s.slice(0, -1).split("").join("/");
  return `${dirs}/${s}/${s}-0.txt`;
}

function fuentes(id: number): string[] {
  const m = rutaEspejo(id);
  return [
    `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`,
    `https://gutenberg.pglaf.org/${m}`,
    `http://mirrors.xmission.com/gutenberg/${m}`,
    `https://www.gutenberg.org/files/${id}/${id}-0.txt`,
  ];
}

export async function textoGutenberg(id: number): Promise<string | null> {
  const cache = `textos/${id}.txt`;
  const guardado = await r2GetText(cache).catch(() => null);
  // Guard de sanidad: un archivo de dos líneas es una página de error cacheada,
  // no un libro. Mejor volver a bajarlo que narrar un mensaje de "503".
  if (guardado && guardado.length > 5000) return guardado;

  for (const url of fuentes(id)) {
    const res = await fetchRetry(url, { tries: 2, timeoutMs: 45000 }).catch(() => null);
    if (!res || !res.ok) continue;
    const txt = await res.text().catch(() => "");
    if (txt.length < 5000) continue;
    await r2Put(cache, Buffer.from(txt, "utf8"), "text/plain; charset=utf-8").catch(() => {});
    return txt;
  }
  return null;
}
