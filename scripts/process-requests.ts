// Procesa la COLA de títulos pedidos por usuarios ("¿No encontraste tu título?").
// Por cada pedido pendiente: lo busca en Project Gutenberg (dominio público),
// lo ingesta, le genera sinopsis + resumen (ES e EN) y el audio de la sinopsis
// en las 2 voces (Onyx/Nova), marca el pedido como listo y avisa al usuario por mail.
// La cola vive en Vercel Blob (solicitudes.json), escrita por /api/solicitar.
//
// Uso:   npx tsx scripts/process-requests.ts            # procesa todos los pendientes
//        REQ_LIMIT=3 npx tsx scripts/process-requests.ts  # tope de pedidos por corrida
import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { r2Put, r2GetText, isR2Configured } from "../src/lib/r2";
import { prisma, sleep, fetchRetry } from "./db";
import { slugify } from "../src/lib/text";
import { mapCategories } from "../src/lib/categories";
import { EdgeTTSProvider } from "../src/lib/tts/edge";
import { chunkText } from "../src/lib/tts/text";
import type { Language } from "../src/lib/types";

const LIMIT = Number(process.env.REQ_LIMIT ?? 50);
const QUEUE = "solicitudes.json";

type Req = {
  email: string;
  title: string;
  at: string;
  status: "pendiente" | "listo" | "no_encontrado" | "error";
  slug?: string;
  bookTitle?: string;
  doneAt?: string;
};

// ---------- Cola en R2 ----------
async function loadQueue(): Promise<Req[]> {
  const raw = await r2GetText(QUEUE);
  if (!raw) return [];
  try { return JSON.parse(raw) as Req[]; } catch { return []; }
}
async function saveQueue(queue: Req[]): Promise<void> {
  await r2Put(QUEUE, JSON.stringify(queue), "application/json");
}

// ---------- Búsqueda en Gutenberg (Gutendex + fallback directo a gutenberg.org) ----------
type Match = { id: number; title: string; author: string; language: Language; epubUrl: string | null; subjects: string[]; description: string; downloads: number };
// { ok:false } = no se pudo conectar (dejar pendiente y reintentar luego)
type SearchResult = { ok: boolean; match: Match | null };

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}
// ¿El resultado se parece de verdad al pedido? (evita traer cualquier cosa)
function looksRelated(query: string, title: string): boolean {
  const q = new Set(norm(query).split(" ").filter((w) => w.length > 2));
  if (q.size === 0) return true;
  const t = new Set(norm(title).split(" "));
  let hits = 0;
  for (const w of q) if (t.has(w)) hits++;
  return hits / q.size >= 0.5;
}

// --- Gutendex (preferido: JSON limpio con descripción real) ---
async function gutendexSearch(query: string): Promise<SearchResult> {
  const url = `https://gutendex.com/books/?search=${encodeURIComponent(query)}&copyright=false`;
  const res = await fetchRetry(url, { tries: 3, timeoutMs: 20000 });
  if (!res || !res.ok) return { ok: false, match: null };
  const data = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const b of (data.results ?? []) as any[]) {
    if (b.copyright !== false) continue;
    const langs: string[] = b.languages ?? [];
    const language: Language | null = langs.includes("es") ? "es" : langs.includes("en") ? "en" : null;
    if (!language) continue;
    const title: string = (b.title ?? "").trim();
    if (!looksRelated(query, title)) continue;
    const raw: string | undefined = b.summaries?.[0];
    const description = raw
      ? raw.replace(/\(This is an automatically generated summary\.\)/gi, "").replace(/\s+/g, " ").trim().slice(0, 320)
      : `Obra de dominio público de ${b.authors?.[0]?.name ?? "autor desconocido"}.`;
    const formats: Record<string, string> = b.formats ?? {};
    return {
      ok: true,
      match: {
        id: b.id, title, author: b.authors?.[0]?.name ?? "Anónimo", language,
        epubUrl: formats["application/epub+zip"] ?? null,
        subjects: [...(b.subjects ?? []), ...(b.bookshelves ?? [])], description, downloads: b.download_count ?? 0,
      },
    };
  }
  return { ok: true, match: null };
}

// --- Fallback directo a gutenberg.org (cuando Gutendex banea el IP / 000) ---
function decodeEntities(s: string): string {
  return s.replace(/&#x([0-9a-fA-F]+);?/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);?/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}
const grab = (re: RegExp, s: string): string | null => {
  const m = s.match(re);
  return m ? decodeEntities(m[1]).replace(/\s+/g, " ").trim() : null;
};
function formatAuthor(raw: string | null): string {
  if (!raw) return "Anónimo";
  const p = raw.split(",");
  return p.length === 2 ? `${p[1].trim()} ${p[0].trim()}` : raw.trim();
}
function cleanTitle(raw: string | null): string {
  if (!raw) return "Sin título";
  const base = raw
    .replace(/\s*:\s*\$[a-z]\s*/gi, " — ") // subcampo MARC " : $b " → guion
    .replace(/\$[a-z]\s*/gi, "") // restos "$a/$b/$c"
    .split(/[;\n]/)[0]
    .replace(/\s*—\s*\[([^\]]+)\]\s*$/, " ($1)") // "— [Peter and Wendy]" → "(Peter and Wendy)"
    .replace(/\s+/g, " ")
    .trim();
  const vol = raw.match(/\b(?:t\.?|tomo|vol\.?|volumen|volume|part|parte)\s*(\d{1,3})\b/i);
  return vol ? `${base} - Tomo ${vol[1]}` : base;
}

async function gutenbergDirectSearch(query: string): Promise<SearchResult> {
  const res = await fetchRetry(
    `https://www.gutenberg.org/ebooks/search/?query=${encodeURIComponent(query)}&submit_search=Search`,
    { tries: 3, timeoutMs: 25000 },
  );
  if (!res || !res.ok) return { ok: false, match: null };
  const html = await res.text();
  const ids: number[] = [];
  for (const m of html.matchAll(/\/ebooks\/(\d+)/g)) {
    const id = Number(m[1]);
    if (!ids.includes(id)) ids.push(id);
    if (ids.length >= 10) break;
  }
  let reachedRdf = false;
  for (const id of ids) {
    const r = await fetchRetry(`https://www.gutenberg.org/ebooks/${id}.rdf`, { tries: 2, timeoutMs: 25000 });
    await sleep(200);
    if (!r || !r.ok) continue;
    reachedRdf = true;
    const rdf = await r.text();
    const rights = grab(/<dcterms:rights>([\s\S]*?)<\/dcterms:rights>/, rdf) ?? "";
    if (!/public domain/i.test(rights)) continue;
    const langCode = grab(/<dcterms:language>[\s\S]*?<rdf:value[^>]*>([a-z-]+)<\/rdf:value>/, rdf);
    const language: Language | null = langCode === "es" ? "es" : langCode === "en" ? "en" : null;
    if (!language) continue;
    const title = cleanTitle(grab(/<dcterms:title>([\s\S]*?)<\/dcterms:title>/, rdf));
    if (!looksRelated(query, title)) continue;
    const author = formatAuthor(grab(/<pgterms:name>([\s\S]*?)<\/pgterms:name>/, rdf));
    const downloads = Number(grab(/<pgterms:downloads[^>]*>(\d+)<\/pgterms:downloads>/, rdf) ?? "0");
    const subjects = [...rdf.matchAll(/<rdf:value[^>]*>([^<]+)<\/rdf:value>/g)]
      .map((m) => m[1].trim()).filter((v) => (v.length > 3 && /[a-zA-Z]/.test(v) && v.includes(" ")) || v.length > 6);
    const epubUrl = grab(/rdf:about="(https?:\/\/www\.gutenberg\.org\/[^"]*\.epub[^"]*)"/, rdf);
    const description = language === "es"
      ? `Obra de dominio público de ${author}. Audiolibro y e-book gratis para escuchar y descargar.`
      : `Public-domain work by ${author}. Free audiobook and e-book to listen and download.`;
    return { ok: true, match: { id, title, author, language, epubUrl, subjects, description, downloads } };
  }
  return { ok: reachedRdf || ids.length > 0, match: null };
}

async function search(query: string): Promise<SearchResult> {
  let reachable = false;
  for (const fn of [gutendexSearch, gutenbergDirectSearch]) {
    try {
      const r = await fn(query);
      if (r.ok) reachable = true;
      if (r.match) return { ok: true, match: r.match };
    } catch { /* probamos la siguiente fuente */ }
  }
  return { ok: reachable, match: null };
}

// ---------- Ingesta ----------
const pendingAudio = () => JSON.stringify([
  { voiceId: "onyx", voiceName: "Onyx · voz masculina", youtubeVideoId: null, durationSeconds: null, status: "pending" },
  { voiceId: "nova", voiceName: "Nova · voz femenina", youtubeVideoId: null, durationSeconds: null, status: "pending" },
]);

async function uniqueSlug(base: string, gutenbergId: number): Promise<string> {
  const existing = await prisma.book.findUnique({ where: { slug: base } });
  if (!existing || existing.gutenbergId === gutenbergId) return base;
  return `${base}-${gutenbergId}`;
}

async function upsertBook(m: Match): Promise<string> {
  const slug = await uniqueSlug(slugify(m.title), m.id);
  const categories = mapCategories(m.subjects);
  const common = {
    slug, title: m.title, author: m.author, language: m.language,
    contentLayer: 1, contentType: "full_audiobook", status: "published", licenseStatus: "public_domain",
    categories: JSON.stringify(categories), description: m.description,
    coverImageUrl: null, // tapa diseñada (sin Gutenberg); verify-covers puede mejorarla luego
    sourceName: "Project Gutenberg", sourceUrl: `https://www.gutenberg.org/ebooks/${m.id}`,
    copyright: false, ebookEpubUrl: m.epubUrl, ebookPdfUrl: null,
    audioVersions: pendingAudio(), downloadCount: m.downloads, publishedAt: new Date(),
  };
  const book = await prisma.book.upsert({
    where: { gutenbergId: m.id },
    create: { ...common, gutenbergId: m.id, textDownloaded: false, textPath: null },
    update: { title: m.title, author: m.author, language: m.language, description: m.description, downloadCount: m.downloads },
  });
  return book.slug;
}

// ---------- Generación de sinopsis/resumen (texto) ----------
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
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("Falta OPENAI_API_KEY.");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
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

// ---------- Audio de la sinopsis (Onyx/Nova) a Blob ----------
async function narrate(text: string, lang: Language, voice: "onyx" | "nova"): Promise<Buffer> {
  const tts = new EdgeTTSProvider({ language: lang });
  const bufs: Buffer[] = [];
  for (const c of chunkText(text)) bufs.push(await tts.generate(c, { voice, speed: 1.04 }));
  return Buffer.concat(bufs);
}

// ---------- Generación completa de un libro ----------
async function buildEverything(slug: string): Promise<void> {
  const book = await prisma.book.findUnique({ where: { slug } });
  if (!book) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let summary: any;
  try { summary = JSON.parse(book.summary ?? "{}"); } catch { summary = {}; }

  for (const lang of ["es", "en"] as Language[]) {
    summary[lang] = summary[lang] ?? {};
    // Sinopsis (texto)
    if (!summary[lang].sinopsis?.text) {
      const text = await genSinopsis(book.title, book.author, lang);
      summary[lang].sinopsis = { ...(summary[lang].sinopsis ?? {}), text };
      console.log(`   ✓ sinopsis ${lang} (${text.split(/\s+/).length} palabras)`);
    }
    // Sinopsis (audio Onyx + Nova → Blob)
    const s = summary[lang].sinopsis;
    s.audio = s.audio ?? {};
    for (const voice of ["onyx", "nova"] as const) {
      if (s.audio[voice]) continue;
      try {
        const audio = await narrate(s.text, lang, voice);
        const url = await r2Put(`sinopsis/${slug}-${lang}-${voice}.mp3`, audio, "audio/mpeg");
        s.audio[voice] = url;
        console.log(`   ✓ audio sinopsis ${lang}/${voice}`);
        await sleep(100);
      } catch (e) {
        console.error(`   ✗ audio ${lang}/${voice}: ${(e as Error).message}`);
      }
    }
    // Resumen (texto)
    if (!summary[lang].resumen?.text) {
      const text = await genResumen(book.title, book.author, lang);
      summary[lang].resumen = { ...(summary[lang].resumen ?? {}), text };
      console.log(`   ✓ resumen ${lang} (${text.split(/\s+/).length} palabras)`);
    }
    // Persistimos parcial por idioma (resiliencia)
    await prisma.book.update({ where: { slug }, data: { summary: JSON.stringify(summary) } });
  }
}

// ---------- Aviso por mail (opcional, vía Resend) ----------
async function notify(req: Req): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFY_FROM ?? "Biblioteca Abierta <onboarding@resend.dev>";
  if (!key) { console.log(`   ✉️  (sin RESEND_API_KEY: avisar a mano a ${req.email})`); return; }
  const ok = req.status === "listo";
  const link = ok ? `https://biblioteca-audiolibros.vercel.app/libro/${req.slug}` : "https://biblioteca-audiolibros.vercel.app";
  const subject = ok ? `Ya tenés "${req.bookTitle}" en Biblioteca Abierta` : `Sobre tu pedido "${req.title}"`;
  const html = ok
    ? `<p>¡Hola!</p><p>Ya subimos <strong>${req.bookTitle}</strong> que pediste: con libro, sinopsis y resumen, en español e inglés, y audio en dos voces.</p><p><a href="${link}">Escuchalo o leelo acá →</a></p><p>Gracias por usar Biblioteca Abierta 📚</p>`
    : `<p>¡Hola!</p><p>Buscamos <strong>${req.title}</strong> pero todavía no lo encontramos en dominio público. Lo seguimos intentando y, si aparece, te avisamos.</p><p>Mientras tanto, podés <a href="${link}">explorar la biblioteca</a>.</p>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: req.email, subject, html }),
    });
    console.log(res.ok ? `   ✉️  aviso enviado a ${req.email}` : `   ✗ mail ${res.status}`);
  } catch (e) {
    console.error(`   ✗ mail: ${(e as Error).message}`);
  }
}

// ---------- Main ----------
async function main() {
  if (!isR2Configured()) throw new Error("R2 no configurado (faltan vars R2_*).");
  const queue = await loadQueue();
  const pending = queue.filter((r) => r.status === "pendiente").slice(0, LIMIT);
  console.log(`\n📥 Cola de pedidos: ${queue.length} total · ${pending.length} a procesar.\n`);
  if (pending.length === 0) { console.log("Nada pendiente. ✅"); return; }

  const generados: Req[] = []; // los resueltos EN ESTA corrida (para avisarte)
  for (const req of pending) {
    console.log(`\n🔎 "${req.title}" (pedido por ${req.email || "anónimo"})`);
    try {
      const { ok, match: m } = await search(req.title);
      if (!ok) {
        // No se pudo consultar Gutenberg (IP baneada / caído): se deja PENDIENTE
        // para reintentar en la próxima corrida. No se avisa al usuario.
        console.log(`   ⏳ Gutenberg no respondió; queda pendiente para reintentar.`);
        continue;
      }
      if (!m) {
        req.status = "no_encontrado";
        req.doneAt = new Date().toISOString();
        console.log(`   ✗ no encontrado en dominio público.`);
        await notify(req);
        await saveQueue(queue);
        continue;
      }
      console.log(`   → "${m.title}" de ${m.author} [${m.language}] (Gutenberg ${m.id})`);
      const slug = await upsertBook(m);
      await buildEverything(slug);
      req.status = "listo";
      req.slug = slug;
      req.bookTitle = m.title;
      req.doneAt = new Date().toISOString();
      generados.push(req);
      console.log(`   ✅ listo → /libro/${slug}`);
      await notify(req);
      await saveQueue(queue); // guardamos la cola tras cada pedido (resiliencia)
    } catch (e) {
      req.status = "error";
      console.error(`   ✗ error: ${(e as Error).message}`);
      await saveQueue(queue);
    }
  }

  // Resumen de ESTA corrida → archivo que el workflow usa para avisarte (GitHub issue).
  if (generados.length) {
    const lines = generados.map(
      (r) => `- **${r.bookTitle}** → https://biblioteca-audiolibros.vercel.app/libro/${r.slug}` +
        (r.email ? `  _(pedido por ${r.email})_` : ""),
    );
    await writeFile("new-titles.txt", `${generados.length} título(s) nuevo(s) generado(s):\n\n${lines.join("\n")}\n`, "utf8");
  } else {
    await writeFile("new-titles.txt", "", "utf8");
  }

  const listos = queue.filter((r) => r.status === "listo").length;
  console.log(`\n✅ Corrida lista. ${generados.length} nuevos esta vez · ${listos} resueltos en total.\n`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
