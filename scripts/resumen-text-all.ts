// Genera el TEXTO del RESUMEN completo (recuento narrativo, sin opiniones) para
// TODO el catálogo, en ES y EN. Lo hace POR PARTES y en PARALELO (rápido).
// Solo texto (el audio del resumen va a YouTube aparte). Idempotente.
//
// Uso:  npx tsx scripts/resumen-text-all.ts
import "dotenv/config";
import { prisma, sleep } from "./db";
import type { Language } from "../src/lib/types";

const MODEL = process.env.OPENAI_SUMMARY_MODEL ?? "gpt-4o-mini";
const SECTIONS = 8;

const SYS_RETELL =
  "Narrás la historia de una obra de DOMINIO PÚBLICO como un cuento, recontando QUÉ pasa. " +
  "SOLO los hechos de la trama, SIN opiniones, SIN análisis, SIN interpretaciones. Recuento " +
  "neutral con tus palabras (no copies frases del texto). Tono de narrador claro, para escuchar. " +
  "Párrafos fluidos, sin títulos ni encabezados.";

async function chat(system: string, user: string, maxTokens: number): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL, temperature: 0.6, max_tokens: maxTokens,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const j = await res.json();
  return (j.choices?.[0]?.message?.content ?? "").trim();
}

async function longRetelling(title: string, author: string, lang: Language): Promise<string> {
  const idioma = lang === "es" ? "español" : "inglés";
  const outline = await chat(
    "Devolvés SOLO una lista numerada, sin texto extra.",
    `Dividí la trama completa de "${title}", de ${author}, en ${SECTIONS} segmentos cronológicos (de principio a fin, incluyendo el desenlace). Devolvé solo la lista numerada con un título breve por segmento, en ${idioma}.`,
    600,
  );
  const sections = outline.split("\n").map((l) => l.replace(/^\s*\d+[.)]\s*/, "").trim()).filter((l) => l.length > 2);
  // Todas las partes en PARALELO.
  const parts = await Promise.all(
    sections.map((sec, i) =>
      chat(
        SYS_RETELL,
        `Obra: "${title}", de ${author}. Contá en DETALLE y SIN opiniones qué sucede en la parte ${i + 1} de ${sections.length}: "${sec}". 400-600 palabras, en ${idioma}. No repitas otras partes. Arrancá directo con la narración, sin título.`,
        1500,
      ).catch(() => ""),
    ),
  );
  return parts.filter(Boolean).join("\n\n");
}

async function main() {
  if (!process.env.OPENAI_API_KEY) throw new Error("Falta OPENAI_API_KEY.");
  const books = await prisma.book.findMany({ where: { contentLayer: 1 }, orderBy: { downloadCount: "desc" } });
  const pending = books.filter((b) => {
    try { const s = JSON.parse(b.summary ?? "{}"); return !(s.es?.resumen?.text && s.en?.resumen?.text); }
    catch { return true; }
  });
  console.log(`\n📚 Resúmenes (texto) para ${pending.length} libros (de ${books.length}).\n`);

  let done = 0;
  for (const b of pending) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const summary: any = (() => { try { return JSON.parse(b.summary ?? "{}"); } catch { return {}; } })();
      // ES y EN en paralelo.
      const [es, en] = await Promise.all([
        summary.es?.resumen?.text ? Promise.resolve(summary.es.resumen.text) : longRetelling(b.title, b.author, "es"),
        summary.en?.resumen?.text ? Promise.resolve(summary.en.resumen.text) : longRetelling(b.title, b.author, "en"),
      ]);
      summary.es = { ...(summary.es ?? {}), resumen: { ...(summary.es?.resumen ?? {}), text: es } };
      summary.en = { ...(summary.en ?? {}), resumen: { ...(summary.en?.resumen ?? {}), text: en } };
      await prisma.book.update({ where: { id: b.id }, data: { summary: JSON.stringify(summary) } });
      done++;
      if (done % 10 === 0) console.log(`  ${done}/${pending.length}`);
      await sleep(100);
    } catch (e) {
      console.error(`  ✗ ${b.slug}: ${(e as Error).message}`);
    }
  }
  console.log(`\n✅ Resúmenes (texto) generados: ${done}/${pending.length}.\n`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
