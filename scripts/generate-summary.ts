// Audios derivados de un libro (ES + EN), gratis (edge-tts):
//   sinopsis → ~2-3 min: presenta el libro SIN spoilers, genera interés. (cualquier libro)
//   resumen  → ~20-30 min: recuento COMPLETO sin opiniones (todos los hechos,
//              personajes y el final), como convertir el libro en un cuento corto.
//              SOLO dominio público.
//
// Uso:  npx tsx scripts/generate-summary.ts <slug> [sinopsis|resumen]
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "./db";
import { EdgeTTSProvider } from "../src/lib/tts/edge";
import { chunkText } from "../src/lib/tts/text";
import type { Language } from "../src/lib/types";

const SLUG = process.argv[2];
const MODE = (process.argv[3] ?? "sinopsis") as "sinopsis" | "resumen";
const LANGS: Language[] = ["es", "en"];

const SYS_SINOPSIS =
  "Escribís la SINOPSIS de un libro para presentarlo y generar ganas de leerlo/escucharlo. " +
  "REGLAS: NO cuentes la trama, NO spoilees, NO reveles el final. Presentá el tono, el " +
  "mundo, el conflicto inicial y por qué engancha, como una gran contratapa. Tono cálido, " +
  "para audio. 280-380 palabras, un solo bloque, sin títulos ni listas.";

const SYS_RESUMEN =
  "Narrás la historia de una obra de DOMINIO PÚBLICO como un cuento, recontando QUÉ pasa. " +
  "REGLAS ESTRICTAS: SOLO los hechos de la trama, SIN opiniones, SIN análisis, SIN juicios " +
  "ni interpretaciones; nada de 'esta obra explora' o 'es una reflexión sobre'. Recuento " +
  "neutral, con tus propias palabras (no copies frases del texto). Tono de narrador claro, " +
  "para escuchar. Párrafos fluidos, sin títulos ni listas ni encabezados.";

async function chat(system: string, user: string, maxTokens: number): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("Falta OPENAI_API_KEY.");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_SUMMARY_MODEL ?? "gpt-4o-mini",
      temperature: 0.6,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  return (j.choices?.[0]?.message?.content ?? "").trim();
}

// Resumen LARGO por partes: arma un índice de la trama y narra cada parte en
// detalle. Así se logra el largo real (~20-30 min), que un solo prompt no da.
async function longRetelling(title: string, author: string, lang: Language): Promise<string> {
  const idioma = lang === "es" ? "español" : "inglés";
  const outline = await chat(
    "Sos un guía de lectura. Devolvés SOLO una lista numerada, sin texto extra.",
    `Dividí la trama completa de "${title}", de ${author}, en 9 segmentos cronológicos (de principio a fin, incluyendo el desenlace). Devolvé solo la lista numerada con un título breve por segmento, en ${idioma}.`,
    700,
  );
  const sections = outline
    .split("\n")
    .map((l) => l.replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter((l) => l.length > 2);

  const parts: string[] = [];
  for (let i = 0; i < sections.length; i++) {
    const t = await chat(
      SYS_RESUMEN,
      `Obra: "${title}", de ${author}. Estás contando la historia por partes. ` +
        `Contá en DETALLE y SIN opiniones qué sucede en esta parte (${i + 1} de ${sections.length}): "${sections[i]}". ` +
        `400-600 palabras, en ${idioma}. No repitas partes anteriores ni adelantes las que siguen. ` +
        `No pongas título ni el número de parte; arrancá directo con la narración.`,
      1500,
    );
    if (t) parts.push(t);
  }
  return parts.join("\n\n");
}

async function writeText(title: string, author: string, lang: Language): Promise<string> {
  const idioma = lang === "es" ? "español" : "inglés";
  if (MODE === "resumen") return longRetelling(title, author, lang);
  return chat(
    SYS_SINOPSIS,
    `Obra: "${title}", de ${author}. Escribí la sinopsis sin spoilers en ${idioma}.`,
    700,
  );
}

async function main() {
  if (!SLUG) throw new Error("Pasá el slug. Ej: npx tsx scripts/generate-summary.ts dracula resumen");
  const book = await prisma.book.findUnique({ where: { slug: SLUG } });
  if (!book) throw new Error(`No existe "${SLUG}".`);
  if (MODE === "resumen" && book.contentLayer !== 1) {
    throw new Error("El RESUMEN completo es solo para dominio público (Capa 1).");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const summary: any = (() => {
    try { return JSON.parse(book.summary ?? "{}"); } catch { return {}; }
  })();

  const dir = path.join(process.cwd(), "public", "audio");
  await mkdir(dir, { recursive: true });

  for (const lang of LANGS) {
    console.log(`\n📝 ${MODE} de "${book.title}" en ${lang}...`);
    const text = await writeText(book.title, book.author, lang);
    const mins = Math.round(text.length / 900);
    const words = text.split(/\s+/).length;
    console.log(`   ${words} palabras (~${mins} min). Narrando (gratis)...`);

    const tts = new EdgeTTSProvider({ language: lang });
    const buffers: Buffer[] = [];
    for (const chunk of chunkText(text)) {
      buffers.push(await tts.generate(chunk, { voice: "nova", speed: 1.04 }));
    }
    const fileName = `${SLUG}-${MODE}-${lang}.mp3`;
    await writeFile(path.join(dir, fileName), Buffer.concat(buffers));
    summary[lang] = { ...(summary[lang] ?? {}), [MODE]: { text, audioUrl: `/audio/${fileName}` } };
    console.log(`   ✓ ${lang}: ${MODE} (~${mins} min).`);
  }

  await prisma.book.update({ where: { slug: SLUG }, data: { summary: JSON.stringify(summary) } });
  console.log(`\n✅ ${MODE} guardado para "${book.title}".\n`);
}

main()
  .catch((e) => {
    console.error("\n✗", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
