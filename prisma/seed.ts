// Seed: reconstruye la base desde prisma/seed-data.json (snapshot versionado del
// catálogo). Así el build de Vercel produce EXACTAMENTE el mismo catálogo, sin
// depender de red ni de la base local. Idempotente (borra y recarga).
//
// Para actualizar el snapshot tras una ingesta:  npx tsx scripts/export-seed.ts
import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

type SeedRow = Record<string, unknown> & { publishedAt: string | null };

async function main() {
  const file = path.join(process.cwd(), "prisma", "seed-data.json");
  const rows: SeedRow[] = JSON.parse(readFileSync(file, "utf8"));
  console.log(`Sembrando ${rows.length} libros desde seed-data.json...`);

  await prisma.book.deleteMany();
  for (const r of rows) {
    const { publishedAt, ...rest } = r;
    await prisma.book.create({
      data: {
        ...(rest as object),
        publishedAt: publishedAt ? new Date(publishedAt) : null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });
  }
  const total = await prisma.book.count();
  console.log(`Listo. ${total} libros en la base.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
