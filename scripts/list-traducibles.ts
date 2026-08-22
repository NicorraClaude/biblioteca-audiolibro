// Libros de dominio público en inglés que todavía no tienen narración en español.
// Un slug por línea, repartible en sesiones paralelas (SHARD/SHARDS).
//
// El público de la biblioteca es hispanohablante y 520 de los 606 clásicos están en
// inglés: sin esto, casi todo el catálogo suena en un idioma que la mayoría no habla.
import { prisma } from "./db";

const LIMIT = Number(process.argv[2] ?? 50);
const DESTINO = process.env.DESTINO ?? "es";
const SHARD = Number(process.env.SHARD ?? 0);
const SHARDS = Number(process.env.SHARDS ?? 1);

async function main() {
  const rows = await prisma.book.findMany({
    where: { contentLayer: 1, gutenbergId: { not: null }, language: { not: DESTINO } },
    orderBy: [{ downloadCount: "desc" }, { slug: "asc" }],
    select: { slug: true, language: true, audioVersions: true },
  });

  const pendientes: string[] = [];
  for (const r of rows) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let vs: any[] = [];
    try { vs = JSON.parse(r.audioVersions ?? "[]"); } catch { /* ignore */ }
    // Sin `language` la grabación es del texto original (son anteriores a esto).
    const yaEnDestino = vs.some((v) => (v.language ?? r.language) === DESTINO && v.audioUrl);
    if (!yaEnDestino) pendientes.push(r.slug);
  }

  const mios = SHARDS > 1 ? pendientes.filter((_, i) => i % SHARDS === SHARD) : pendientes;
  console.log(mios.slice(0, LIMIT).join("\n"));
}

main().finally(() => prisma.$disconnect());
