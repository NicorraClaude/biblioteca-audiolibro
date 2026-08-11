// Detecta los videos que ya no existen en YouTube y los borra del catálogo, para
// que el uploader los vuelva a generar y subir.
//
// PARA QUÉ: si un video se borra a mano en Studio (porque salió mal, como los que
// quedaron con la pantalla en negro), el catálogo sigue guardando su ID y el
// uploader lo saltea por "ya subido". Resultado: la ficha apunta a un video muerto
// y nadie lo regenera nunca.
//
// Cómo comprueba: el endpoint oembed de YouTube, que es público y no necesita
// credenciales — el token de la app solo tiene permiso de SUBIR, ni siquiera puede
// leer. Un 200 significa visible; un 404, borrado o privado.
//
// Uso:   npx tsx scripts/limpiar-videos-borrados.ts          (solo informa)
//        APLICAR=1 npx tsx scripts/limpiar-videos-borrados.ts (borra los IDs muertos)
import "dotenv/config";
import { prisma } from "./db";

const APLICAR = process.env.APLICAR === "1";

async function existe(id: string): Promise<boolean> {
  try {
    const r = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`);
    return r.status === 200;
  } catch {
    // Ante un problema de red no se asume que el video murió: sería borrar un ID
    // bueno y volver a subir un video que ya existe (duplicado en el canal).
    return true;
  }
}

async function main() {
  const libros = await prisma.book.findMany({ where: { summary: { not: null } } });
  let revisados = 0;
  let muertos = 0;

  for (const b of libros) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let s: any;
    try { s = JSON.parse(b.summary ?? "{}"); } catch { continue; }
    let cambio = false;

    for (const lang of ["es", "en"] as const) {
      const r = s?.[lang]?.resumen;
      const id = r?.youtubeVideoId;
      if (!id) continue;
      revisados++;
      if (await existe(id)) continue;

      muertos++;
      console.log(`✗ ${id} ya no existe → ${b.title} (${lang})`);
      if (APLICAR) {
        r.youtubeVideoId = null;
        r.youtubePublic = false;
        cambio = true;
      }
    }

    if (cambio) {
      await prisma.book.update({ where: { id: b.id }, data: { summary: JSON.stringify(s) } });
    }
  }

  console.log(`\n${revisados} video(s) revisado(s) · ${muertos} muerto(s).`);
  if (muertos && !APLICAR) console.log("Para volver a ponerlos en la cola: APLICAR=1 npx tsx scripts/limpiar-videos-borrados.ts\n");
  else if (muertos) console.log("Listos para regenerarse con la tapa diseñada.\n");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
