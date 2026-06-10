// Lista slugs de libros Capa 1 para narrar: sin grabación de LibriVox y sin
// audio propio todavía, ordenados por popularidad. Imprime un slug por línea.
// Uso:  npx tsx scripts/list-narratable.ts [cantidad]
import { prisma } from "./db";

const LIMIT = Number(process.argv[2] ?? 8);

async function main() {
  const rows = await prisma.book.findMany({
    where: { contentLayer: 1, librivoxUrl: null, gutenbergId: { not: null } },
    orderBy: { downloadCount: "desc" },
    take: 60,
    select: { slug: true, audioVersions: true },
  });
  const out: string[] = [];
  for (const r of rows) {
    if (out.length >= LIMIT) break;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let versions: any[] = [];
    try {
      versions = JSON.parse(r.audioVersions ?? "[]");
    } catch {
      /* ignore */
    }
    const yaTieneAudio = versions.some(
      (v) => v.youtubeVideoId || v.audioUrl,
    );
    if (!yaTieneAudio) out.push(r.slug);
  }
  console.log(out.join("\n"));
}

main().finally(() => prisma.$disconnect());
