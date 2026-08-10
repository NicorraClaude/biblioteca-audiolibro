// Genera sinopsis + resumen (ES e EN) + audio de sinopsis (Onyx/Nova → Blob)
// para los libros que TODAVÍA no los tienen (los que creció el cron y nunca
// pasaron por el pipeline de resúmenes). Idempotente: saltea lo que ya está.
//
// Uso:  REQ_LIMIT=10 npx tsx scripts/fill-summaries.ts
import "dotenv/config";
import { r2Put, isR2Configured } from "../src/lib/r2";
import { prisma, sleep } from "./db";
import { EdgeTTSProvider } from "../src/lib/tts/edge";
import { chunkText } from "../src/lib/tts/text";
import { readFile, writeFile } from "node:fs/promises";
import type { Language } from "../src/lib/types";

const LIMIT = Number(process.env.REQ_LIMIT ?? 40);

// --- Reparto en sesiones paralelas ---
// Varios jobs corren a la vez, cada uno con SU pedazo del catálogo: el job N toma
// los libros cuya posición en la lista de pendientes da resto N. Sin esto, todos
// los jobs empezarían por el mismo libro y harían el mismo trabajo N veces.
const SHARD = Number(process.env.SHARD ?? 0);
const SHARDS = Number(process.env.SHARDS ?? 1);
// Cada job escribe SU parche (no puede commitear: se pisarían entre sí). Un job
// final los junta y hace un único commit.
const PATCH_OUT = process.env.PATCH_OUT ?? "";

const SYS_SINOPSIS =
  "Escribís la SINOPSIS de un libro para presentarlo y generar ganas de leerlo/escucharlo. " +
  "REGLAS: NO cuentes la trama, NO spoilees, NO reveles el final. Presentá el tono, el mundo, " +
  "el conflicto inicial y por qué engancha, como una gran contratapa. Tono cálido, para audio. " +
  "280-380 palabras, un solo bloque, sin títulos ni listas.";
const SYS_RESUMEN =
  "Narrás la historia de una obra de DOMINIO PÚBLICO como un cuento, recontando QUÉ pasa. " +
  "REGLAS ESTRICTAS: SOLO los hechos de la trama, SIN opiniones, SIN análisis. Recuento neutral, " +
  "con tus propias palabras. Tono de narrador claro, para escuchar. Párrafos fluidos, sin títulos ni listas.";

async function chat(system: string, user: string, maxTokens: number): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_SUMMARY_MODEL ?? "gpt-4o-mini", temperature: 0.6, max_tokens: maxTokens,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return ((await res.json()).choices?.[0]?.message?.content ?? "").trim();
}

async function genSinopsis(title: string, author: string, lang: Language): Promise<string> {
  const idioma = lang === "es" ? "español" : "inglés";
  return chat(SYS_SINOPSIS, `Obra: "${title}", de ${author}. Escribí la sinopsis sin spoilers en ${idioma}.`, 700);
}
async function genResumen(title: string, author: string, lang: Language): Promise<string> {
  const idioma = lang === "es" ? "español" : "inglés";
  const outline = await chat(
    "Sos un guía de lectura. Devolvés SOLO una lista numerada, sin texto extra.",
    `Dividí la trama completa de "${title}", de ${author}, en 9 segmentos cronológicos (de principio a fin, incluyendo el desenlace). Devolvé solo la lista numerada con un título breve por segmento, en ${idioma}.`,
    700,
  );
  const sections = outline.split("\n").map((l) => l.replace(/^\s*\d+[.)]\s*/, "").trim()).filter((l) => l.length > 2);
  const parts: string[] = [];
  for (let i = 0; i < sections.length; i++) {
    const t = await chat(
      SYS_RESUMEN,
      `Obra: "${title}", de ${author}. Contá en DETALLE y SIN opiniones qué sucede en esta parte (${i + 1} de ${sections.length}): "${sections[i]}". 400-600 palabras, en ${idioma}. No repitas partes anteriores ni adelantes las siguientes. Arrancá directo con la narración.`,
      1500,
    );
    if (t) parts.push(t);
  }
  return parts.join("\n\n");
}

async function narrate(text: string, lang: Language, voice: "onyx" | "nova"): Promise<Buffer> {
  const tts = new EdgeTTSProvider({ language: lang });
  const bufs: Buffer[] = [];
  for (const c of chunkText(text)) bufs.push(await tts.generate(c, { voice, speed: 1.04 }));
  return Buffer.concat(bufs);
}

async function buildEverything(slug: string, title: string, author: string): Promise<void> {
  const book = await prisma.book.findUnique({ where: { slug } });
  if (!book) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let summary: any;
  try { summary = JSON.parse(book.summary ?? "{}"); } catch { summary = {}; }

  for (const lang of ["es", "en"] as Language[]) {
    summary[lang] = summary[lang] ?? {};
    if (!summary[lang].sinopsis?.text) {
      summary[lang].sinopsis = { ...(summary[lang].sinopsis ?? {}), text: await genSinopsis(title, author, lang) };
    }
    const s = summary[lang].sinopsis;
    s.audio = s.audio ?? {};
    for (const voice of ["onyx", "nova"] as const) {
      if (s.audio[voice]) continue;
      try {
        const audio = await narrate(s.text, lang, voice);
        const url = await r2Put(`sinopsis/${slug}-${lang}-${voice}.mp3`, audio, "audio/mpeg");
        s.audio[voice] = url;
        await sleep(100);
      } catch (e) {
        console.error(`   ✗ audio ${lang}/${voice}: ${(e as Error).message}`);
      }
    }
    if (!summary[lang].resumen?.text) {
      summary[lang].resumen = { ...(summary[lang].resumen ?? {}), text: await genResumen(title, author, lang) };
    }
    // El resumen largo también lleva audio propio en R2. Antes solo se narraba la
    // sinopsis, así que el resumen quedaba mudo salvo que hubiera video de YouTube
    // — y la cuota de YouTube (6/día) dejaba el catálogo en silencio.
    const r = summary[lang].resumen;
    if (r?.text) {
      r.audio = r.audio ?? {};
      for (const voice of ["onyx", "nova"] as const) {
        if (r.audio[voice]) continue;
        try {
          const audio = await narrate(r.text, lang, voice);
          const url = await r2Put(`resumen/${slug}-${lang}-${voice}.mp3`, audio, "audio/mpeg");
          r.audio[voice] = url;
          console.log(`   ✓ audio resumen ${lang}/${voice} (${(audio.length / 1024 / 1024).toFixed(1)} MB)`);
          await sleep(100);
        } catch (e) {
          console.error(`   ✗ audio resumen ${lang}/${voice}: ${(e as Error).message}`);
        }
      }
    }
    await prisma.book.update({ where: { slug }, data: { summary: JSON.stringify(summary) } });
  }
}

// Un libro está PENDIENTE si le falta texto O si le falta el audio de ese texto.
// (Antes solo miraba el texto: los libros con resumen escrito pero sin narrar
// nunca volvían a entrar, y quedaban mudos para siempre.)
function lacksSummary(raw: string | null): boolean {
  try {
    const s = JSON.parse(raw ?? "{}");
    const hayTexto = s.es?.sinopsis?.text || s.en?.sinopsis?.text || s.es?.resumen?.text || s.en?.resumen?.text;
    if (!hayTexto) return true;
    for (const lang of ["es", "en"] as const) {
      for (const tier of ["sinopsis", "resumen"] as const) {
        const e = s[lang]?.[tier];
        if (!e?.text) continue;
        for (const v of ["onyx", "nova"] as const) if (!e.audio?.[v]) return true;
      }
    }
    return false;
  } catch {
    return true;
  }
}

async function main() {
  if (!isR2Configured()) throw new Error("R2 no configurado (faltan vars R2_*).");
  if (!process.env.OPENAI_API_KEY) throw new Error("Falta OPENAI_API_KEY.");
  const all = await prisma.book.findMany({ where: { contentLayer: 1 }, orderBy: { downloadCount: "desc" } });
  // El orden (downloadCount desc) es estable entre jobs porque todos parten del
  // mismo snapshot: por eso el reparto por resto no deja libros afuera ni repetidos.
  const pendientes = all.filter((b) => lacksSummary(b.summary));
  const mios = SHARDS > 1 ? pendientes.filter((_, i) => i % SHARDS === SHARD) : pendientes;
  const pend = mios.slice(0, LIMIT);
  const reparto = SHARDS > 1 ? ` · sesión ${SHARD + 1}/${SHARDS} (me tocan ${mios.length})` : "";
  console.log(`\n📝 Libros sin sinopsis/resumen: ${pendientes.length}${reparto} · a generar ahora: ${pend.length}\n`);

  let hechos = 0;
  const listos: string[] = [];
  for (const b of pend) {
    console.log(`→ ${b.slug} ("${b.title.slice(0, 40)}")`);
    try {
      await buildEverything(b.slug, b.title, b.author);
      hechos++;
      listos.push(b.slug);
      console.log(`   ✓ listo (${hechos}/${pend.length})`);
    } catch (e) {
      console.error(`   ✗ ${(e as Error).message}`);
    }
  }

  // Parche de esta sesión: solo lo que ELLA generó. El job consolidador los junta.
  // Se ACUMULA sobre el archivo existente porque la sesión llama a este script una
  // vez por libro (para poder cortar por reloj entre libro y libro): si sobrescribiera,
  // el parche final tendría un solo libro y se perdería todo lo anterior.
  if (PATCH_OUT) {
    const rows = listos.length
      ? await prisma.book.findMany({ where: { slug: { in: listos } }, select: { slug: true, summary: true } })
      : [];
    const previos: { slug: string; summary: string | null }[] = await readFile(PATCH_OUT, "utf8")
      .then((t) => JSON.parse(t))
      .catch(() => []);
    const acc = new Map(previos.map((p) => [p.slug, p]));
    for (const r of rows) acc.set(r.slug, r);
    await writeFile(PATCH_OUT, JSON.stringify([...acc.values()], null, 2), "utf8");
    console.log(`📦 Parche: ${PATCH_OUT} (${acc.size} libros acumulados)`);
  }

  console.log(`\n✅ Generados ${hechos} resúmenes esta corrida.\n`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
