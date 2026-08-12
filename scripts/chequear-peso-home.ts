// Avisa ANTES de deployar si la página de inicio se está acercando al límite de
// Vercel, en vez de enterarnos por un mail de deploy fallido.
//
// QUÉ PASÓ. La home le pasa la lista de libros a componentes de cliente, y todo eso
// viaja serializado dentro del HTML. Cuando el catálogo llegó a 614 libros con
// análisis de 8.000 palabras, la página pesó 19,72 MB contra un tope de 19,07 y
// TODOS los deploys empezaron a fallar. El contenido seguía generándose y
// guardándose bien; simplemente dejaba de publicarse. Nos enteramos por ocho mails
// de error, no por el sistema.
//
// CÓMO ESTIMA. Con dos mediciones reales: 16,03 MB de datos dieron 19,72 MB de
// página, y 0,42 MB dieron 2,06 MB. O sea ~1,1 MB de estructura por cada MB de datos
// más un piso fijo. La estimación es aproximada a propósito: sirve para avisar con
// mucho margen, no para predecir al byte.
import { readFileSync } from "node:fs";

const LIMITE_VERCEL = 19.07;
const AVISO = 10; // a partir de acá conviene planear la paginación
const CORTE = 16; // a partir de acá el deploy va a fallar pronto: mejor frenar

type Book = Record<string, unknown>;

// Lo que las tarjetas NO usan y por lo tanto no debería estar viajando.
// (Si algún día una tarjeta necesita uno de estos, sacalo de la lista.)
const NO_VIAJA = new Set(["summary", "description", "ebookEpubUrl", "ebookPdfUrl", "textPath", "licenseRecord", "sourceUrl"]);

const libros: Book[] = JSON.parse(readFileSync("prisma/seed-data.json", "utf8"));
const publicos = libros.filter((b) => b.status === "published");

let bytes = 0;
for (const b of publicos) {
  for (const [k, v] of Object.entries(b)) {
    if (NO_VIAJA.has(k)) continue;
    bytes += String(v ?? "").length;
  }
}
const datosMB = bytes / 1024 / 1024;
const estimadoMB = datosMB * 1.1 + 1.6;

console.log(`📏 Home: ${publicos.length} libros · datos ${datosMB.toFixed(2)} MB · página estimada ~${estimadoMB.toFixed(1)} MB (tope ${LIMITE_VERCEL} MB)`);

if (estimadoMB >= CORTE) {
  console.error(
    `\n✗ La página de inicio está por pasar el límite de Vercel y los deploys van a\n` +
      `  empezar a fallar. Hay que dejar de mandarle el catálogo entero al navegador:\n` +
      `  paginar el catálogo o mover la búsqueda al servidor.\n`,
  );
  process.exit(1);
}
if (estimadoMB >= AVISO) {
  console.warn(
    `\n⚠️  La home ya pesa más de ${AVISO} MB estimados. Todavía deploya, pero conviene\n` +
      `   planear la paginación antes de seguir creciendo el catálogo.\n`,
  );
}
