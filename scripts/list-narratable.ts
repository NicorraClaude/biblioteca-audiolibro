// Lista slugs de libros Capa 1 para narrar COMPLETOS: sin grabación de LibriVox y
// sin audio propio todavía, ordenados por popularidad. Un slug por línea.
//
// Soporta reparto en sesiones paralelas (SHARD/SHARDS), igual que fill-summaries:
// el orden es estable porque todas las sesiones parten del mismo snapshot, así que
// el reparto por resto cubre todo sin que dos sesiones narren el mismo libro —
// narrar dos veces lo mismo son 40 minutos de cómputo tirados y un pisotón en R2.
//
// Uso:  npx tsx scripts/list-narratable.ts [cantidad]
//       SHARD=3 SHARDS=20 npx tsx scripts/list-narratable.ts 50
import { prisma } from "./db";

const LIMIT = Number(process.argv[2] ?? 8);
const SHARD = Number(process.env.SHARD ?? 0);
const SHARDS = Number(process.env.SHARDS ?? 1);

async function main() {
  const rows = await prisma.book.findMany({
    // Solo dominio público: el libro completo únicamente se puede narrar cuando
    // no hay derechos vigentes. Los de Capa 2 llegan hasta el resumen y ahí paran.
    where: { contentLayer: 1, librivoxUrl: null, gutenbergId: { not: null } },
    orderBy: [{ downloadCount: "desc" }, { slug: "asc" }],
    select: { slug: true, audioVersions: true },
  });

  const pendientes: string[] = [];
  for (const r of rows) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let versions: any[] = [];
    try { versions = JSON.parse(r.audioVersions ?? "[]"); } catch { /* ignore */ }
    if (!versions.some((v) => v.youtubeVideoId || v.audioUrl)) pendientes.push(r.slug);
  }

  const mios = SHARDS > 1 ? pendientes.filter((_, i) => i % SHARDS === SHARD) : pendientes;
  console.log(mios.slice(0, LIMIT).join("\n"));
}

main().finally(() => prisma.$disconnect());
