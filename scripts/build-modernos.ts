// Genera las fichas de los libros MODERNOS de negocios (contentLayer=2):
// - Reseña original (400-600 palabras): quién es el autor, qué propone, para
//   quién es, contexto, por qué importa. Contenido nuestro, no copia.
// - Resumen ANALÍTICO extenso (30-45 min = 8000-9000 palabras): dividido en
//   secciones que exploran las ideas centrales del libro con NUESTRAS palabras
//   (transformativo, tipo Blinkist/SparkNotes). Con disclaimer legal.
// - Audio del resumen ES/EN × Onyx/Nova (edge-tts, tono por género).
// - Link Amazon con nuestro tag de afiliado.
// - Categorías (incluye "Negocios y emprendimientos").
// - Idempotente: saltea las que ya están completas. MODE=review|summary|audio|all.
//
// Uso:  REQ_LIMIT=5 npx tsx scripts/build-modernos.ts
import "dotenv/config";
import { r2Put, isR2Configured } from "../src/lib/r2";
import { prisma, sleep } from "./db";
import { EdgeTTSProvider } from "../src/lib/tts/edge";
import { chunkText } from "../src/lib/tts/text";
import { styleFor } from "../src/lib/voice-style";
import type { Language } from "../src/lib/types";
import { MODERNOS_NEGOCIOS, type Moderno } from "./data/negocios-modernos";

const LIMIT = Number(process.env.REQ_LIMIT ?? 5);
const MODE = (process.env.MODE ?? "all") as "review" | "summary" | "audio" | "all";
const VOICES = ["onyx", "nova"] as const;

const DISCLAIMER = "Este es un análisis original de las ideas centrales de la obra. No reproduce el texto del libro. Para la experiencia completa recomendamos comprar la edición original.";

// ---------- LLM helpers ----------
async function chat(system: string, user: string, maxTokens: number): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_SUMMARY_MODEL ?? "gpt-4o-mini",
      temperature: 0.65, max_tokens: maxTokens,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return ((await res.json()).choices?.[0]?.message?.content ?? "").trim();
}

// ---------- Generadores de contenido ----------
async function genReview(m: Moderno): Promise<string> {
  const idioma = m.language === "es" ? "español" : "inglés";
  const sys =
    "Sos un curador editorial. Escribís reseñas ORIGINALES de libros para una biblioteca digital. " +
    "La reseña presenta la obra, situá al autor, contexto histórico, ideas centrales, para quién es, " +
    "por qué importa hoy. Es contenido nuestro, NO reproduce el texto del libro. Prosa fluida, sin " +
    "títulos ni bullets. 400-600 palabras. Cierra invitando a leerlo/comprarlo.";
  const user =
    `Reseñá "${m.title}" (${m.year}) de ${m.author} en ${idioma}. Ideas centrales que debés mencionar y explicar: ${m.keyIdeas.join("; ")}. ` +
    `Tono cálido pero riguroso, para lectores adultos interesados en negocios/desarrollo personal.`;
  return chat(sys, user, 1400);
}

async function genLongSummary(m: Moderno): Promise<string> {
  const idioma = m.language === "es" ? "español" : "inglés";
  // 1) Outline: 8-10 secciones lógicas que cubren las ideas del libro
  const outline = await chat(
    "Sos un guía experto en libros de negocios y desarrollo personal. Devolvés SOLO una lista numerada.",
    `Dividí las ideas centrales de "${m.title}" (${m.author}) en 9 secciones temáticas para un análisis extenso de 40 minutos. ` +
      `Ideas base: ${m.keyIdeas.join("; ")}. Devolvé la lista en ${idioma} — un título breve por sección, sin explicaciones.`,
    600,
  );
  const sections = outline.split("\n").map((l) => l.replace(/^\s*\d+[.)]\s*/, "").trim()).filter((l) => l.length > 2);

  // 2) Cada sección: explicación ANALÍTICA con nuestras palabras (~900-1100 palabras cada una → 8000-9000 total)
  const parts: string[] = [DISCLAIMER + "\n\n"];
  const sys =
    "Sos un analista de libros. Escribís un ANÁLISIS ORIGINAL EN PROFUNDIDAD, con TUS PROPIAS PALABRAS " +
    "y ejemplos propios, sin citar frases del libro. Contenido transformativo (como Blinkist / SparkNotes). " +
    "Prosa fluida y didáctica, sin bullets ni títulos internos. Español rioplatense/neutro claro.";
  for (let i = 0; i < sections.length; i++) {
    const partText = await chat(
      sys,
      `Libro: "${m.title}" (${m.author}). Sección ${i + 1} de ${sections.length}: "${sections[i]}". ` +
        `Escribí un análisis de 900-1100 palabras en ${idioma} que explique esta idea con TUS palabras, ` +
        `ejemplos originales, aplicaciones prácticas y una crítica breve si corresponde. ` +
        `NO cites frases del libro. NO uses títulos ni bullets. Arrancá directo con el análisis.`,
      2400,
    );
    if (partText) parts.push(partText);
  }
  return parts.join("\n\n");
}

// ---------- Narración ----------
async function narrate(text: string, lang: Language, voice: "onyx" | "nova", speed: number, pitch: string): Promise<Buffer> {
  const tts = new EdgeTTSProvider({ language: lang });
  const bufs: Buffer[] = [];
  for (const c of chunkText(text)) bufs.push(await tts.generate(c, { voice, speed, pitch }));
  return Buffer.concat(bufs);
}

// ---------- Upsert del libro moderno como Capa 2 ----------
async function upsertModerno(m: Moderno) {
  const affiliateLinks = JSON.stringify([
    { store: "Amazon", url: `https://www.amazon.com/dp/${m.amazonAsin}` },
    ...(m.bajalibrosSearch ? [{ store: "Bajalibros", url: `https://www.bajalibros.com/AR/search?q=${m.bajalibrosSearch}` }] : []),
  ]);
  const description = `${m.title} — ${m.author} (${m.year}). Análisis original con las ideas centrales de la obra. Contenido curado por Biblioteca Abierta.`;
  return prisma.book.upsert({
    where: { slug: m.slug },
    create: {
      slug: m.slug, title: m.title, author: m.author, language: m.language,
      contentLayer: 2, contentType: "summary", status: "published", licenseStatus: "copyrighted_summary_only",
      categories: JSON.stringify(m.categories), description,
      coverImageUrl: null, sourceName: null, sourceUrl: null, gutenbergId: null,
      copyright: true, ebookEpubUrl: null, ebookPdfUrl: null,
      affiliateLinks, audioVersions: "[]",
      publishedAt: new Date(), downloadCount: 0,
    },
    update: {
      title: m.title, author: m.author, language: m.language,
      contentLayer: 2, categories: JSON.stringify(m.categories), affiliateLinks,
    },
  });
}

// ---------- ¿Está completa la ficha? ----------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function complete(s: any): boolean {
  const langs: Language[] = ["es", "en"];
  for (const l of langs) {
    // reseña como "sinopsis" (mismo campo)
    if (!s?.[l]?.sinopsis?.text) return false;
    if (!s?.[l]?.resumen?.text) return false;
    for (const v of VOICES) if (!s?.[l]?.resumen?.audio?.[v]) return false;
  }
  return true;
}

// ---------- Main ----------
async function main() {
  if (!isR2Configured()) throw new Error("R2 no configurado (faltan vars R2_*).");
  if (!process.env.OPENAI_API_KEY) throw new Error("Falta OPENAI_API_KEY.");
  console.log(`\n💼 Negocios modernos · MODE=${MODE} · LIMIT=${LIMIT}\n`);

  let done = 0;
  for (const m of MODERNOS_NEGOCIOS) {
    if (done >= LIMIT) break;
    // 1) upsert (siempre, es idempotente y rápido)
    const b = await upsertModerno(m);
    // 2) cargar summary actual
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let summary: any; try { summary = JSON.parse(b.summary ?? "{}"); } catch { summary = {}; }

    if (complete(summary) && MODE === "all") continue;

    console.log(`\n→ ${m.slug} (${m.language})`);
    const st = styleFor(m.categories);
    let changed = false;

    for (const lang of ["es", "en"] as Language[]) {
      // Si el libro es en un idioma, solo hago el idioma original + inglés como opcional.
      // Por ahora: hago solo el idioma original para no gastar de más. El otro se puede sumar después.
      if (lang !== m.language) continue;

      summary[lang] = summary[lang] ?? {};

      // Reseña (usamos el slot "sinopsis" para consistencia con el resto del sitio)
      if ((MODE === "review" || MODE === "all") && !summary[lang].sinopsis?.text) {
        console.log(`   · reseña ${lang}...`);
        summary[lang].sinopsis = { ...(summary[lang].sinopsis ?? {}), text: await genReview(m) };
        changed = true;
      }
      // Resumen extenso 30-45min
      if ((MODE === "summary" || MODE === "all") && !summary[lang].resumen?.text) {
        console.log(`   · resumen extenso ${lang} (~40min)...`);
        summary[lang].resumen = { ...(summary[lang].resumen ?? {}), text: await genLongSummary(m) };
        changed = true;
      }
      // Audio del resumen (largo)
      if (MODE === "audio" || MODE === "all") {
        const r = summary[lang].resumen;
        if (r?.text) {
          r.audio = r.audio ?? {};
          for (const voice of VOICES) {
            if (r.audio[voice]) continue;
            const t0 = Date.now();
            try {
              const audio = await narrate(r.text, lang, voice, st.speed, st.pitch);
              const url = await r2Put(`resumen/${m.slug}-${lang}-${voice}.mp3`, audio, "audio/mpeg");
              r.audio[voice] = url;
              changed = true;
              const secs = Math.round((Date.now() - t0) / 1000);
              console.log(`   ✓ audio ${lang}/${voice} (${(audio.length / 1024 / 1024).toFixed(1)} MB, ${secs}s)`);
              await sleep(80);
            } catch (e) {
              console.error(`   ✗ audio ${lang}/${voice}: ${(e as Error).message}`);
            }
          }
          r.audioGenre = st.genre;
        }
      }
    }

    if (changed) {
      await prisma.book.update({ where: { id: b.id }, data: { summary: JSON.stringify(summary) } });
    }
    done++;
    console.log(`   (${done}/${LIMIT} ficha lista)`);
  }
  console.log(`\n✅ Tanda lista: ${done} fichas modernas procesadas.\n`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
