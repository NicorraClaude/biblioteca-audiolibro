// Genera la SINOPSIS (texto, ES+EN) para TODO el catálogo de dominio público.
// Sin spoilers, genera interés. Barato y rápido (solo texto; el audio va aparte).
// Idempotente: saltea los que ya tienen sinopsis.
//
// Uso:  npx tsx scripts/sinopsis-all.ts
import "dotenv/config";
import { prisma, sleep } from "./db";
import type { Language } from "../src/lib/types";

const SYS =
  "Escribís la SINOPSIS de un libro para presentarlo y generar ganas de leerlo. " +
  "REGLAS: NO cuentes la trama, NO spoilees, NO reveles el final. Presentá el tono, " +
  "el mundo, el conflicto inicial y por qué engancha, como una gran contratapa. Tono " +
  "cálido. 220-320 palabras, un solo bloque, sin títulos ni listas.";

async function sinopsis(title: string, author: string, lang: Language): Promise<string> {
  const key = process.env.OPENAI_API_KEY!;
  const idioma = lang === "es" ? "español" : "inglés";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_SUMMARY_MODEL ?? "gpt-4o-mini",
      temperature: 0.6,
      max_tokens: 600,
      messages: [
        { role: "system", content: SYS },
        { role: "user", content: `Obra: "${title}", de ${author}. Escribí la sinopsis sin spoilers en ${idioma}.` },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const j = await res.json();
  return (j.choices?.[0]?.message?.content ?? "").trim();
}

async function main() {
  if (!process.env.OPENAI_API_KEY) throw new Error("Falta OPENAI_API_KEY.");
  const books = await prisma.book.findMany({
    where: { contentLayer: 1 },
    orderBy: { downloadCount: "desc" },
  });
  // Saltea los que ya tienen sinopsis en ambos idiomas.
  const pending = books.filter((b) => {
    try {
      const s = JSON.parse(b.summary ?? "{}");
      return !(s.es?.sinopsis && s.en?.sinopsis);
    } catch {
      return true;
    }
  });
  console.log(`\n📝 Sinopsis para ${pending.length} libros (de ${books.length}).\n`);

  let done = 0;
  for (const b of pending) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const summary: any = (() => { try { return JSON.parse(b.summary ?? "{}"); } catch { return {}; } })();
      for (const lang of ["es", "en"] as Language[]) {
        if (summary[lang]?.sinopsis) continue;
        const text = await sinopsis(b.title, b.author, lang);
        summary[lang] = { ...(summary[lang] ?? {}), sinopsis: { text } };
        await sleep(150);
      }
      await prisma.book.update({ where: { id: b.id }, data: { summary: JSON.stringify(summary) } });
      done++;
      if (done % 10 === 0) console.log(`  ${done}/${pending.length}`);
    } catch (e) {
      console.error(`  ✗ ${b.slug}: ${(e as Error).message}`);
    }
  }
  console.log(`\n✅ Sinopsis generadas: ${done}/${pending.length}.\n`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
