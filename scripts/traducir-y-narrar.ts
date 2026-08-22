// Traduce un libro de dominio público y narra la traducción, para que la
// biblioteca suene en español y no solo se lea.
//
// EL PROBLEMA QUE RESUELVE: el audiolibro es la narración del texto ORIGINAL.
// Traducir el texto no traducía el audio, así que alguien podía leer Moby Dick en
// español, apretar play y escuchar inglés. Con 520 clásicos en inglés y un público
// hispanohablante, eso es casi toda la biblioteca sonando en el idioma equivocado.
//
// La traducción se guarda en la MISMA ruta de R2 que usa la web
// (traducciones/{gutenbergId}-{code}.txt), así el lector la encuentra ya hecha y
// nadie paga la espera. Y el audio se registra con su `language`, que es lo que
// permite a la ficha elegir la grabación que corresponde al idioma que estás leyendo.
//
// Uso:  npx tsx scripts/traducir-y-narrar.ts <slug> [idioma=es] [voz=nova]
import "dotenv/config";
import { prisma, sleep } from "./db";
import { textoGutenberg } from "./lib/texto-gutenberg";
import { EdgeTTSProvider } from "../src/lib/tts/edge";
import { stripGutenbergBoilerplate, splitFrontMatterAndBody, chunkText } from "../src/lib/tts/text";
import { r2Put, r2GetText, isR2Configured } from "../src/lib/r2";
import { nameFor } from "../src/lib/languages";
import type { Language } from "../src/lib/types";
import type { TTSVoiceId } from "../src/lib/tts/types";

const SLUG = process.argv[2];
const DESTINO = (process.argv[3] ?? "es") as Language;
const VOZ = (process.argv[4] ?? "nova") as TTSVoiceId;
const CONCURRENCIA = 8;
// Mismo guard que la narración normal: los gigantes tardan horas y dan archivos
// enormes. Salida 2 = salteado a propósito, no es un fallo.
const MAX_CHARS = Number(process.env.TTS_MAX_BOOK_CHARS ?? 600000);

async function traducirParte(texto: string, idioma: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_TRANSLATE_MODEL ?? "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        { role: "system", content: `Sos un traductor literario. Traducí el texto al ${idioma} respetando el sentido, el tono y el estilo. Devolvé SOLO la traducción, sin notas.` },
        { role: "user", content: texto },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  return ((await res.json()).choices?.[0]?.message?.content ?? "").trim();
}

async function main() {
  if (!SLUG) throw new Error("Pasá el slug. Ej: npx tsx scripts/traducir-y-narrar.ts moby-dick es");
  if (!isR2Configured()) throw new Error("R2 no configurado.");
  if (!process.env.OPENAI_API_KEY) throw new Error("Falta OPENAI_API_KEY.");

  const book = await prisma.book.findUnique({ where: { slug: SLUG } });
  if (!book?.gutenbergId) throw new Error(`"${SLUG}" no existe o no es de Gutenberg.`);
  if (book.contentLayer !== 1) throw new Error(`"${SLUG}" no es de dominio público: no se narra completo.`);
  if (book.language === DESTINO) { console.log(`⏭️  Ya está en ${DESTINO}.`); process.exit(2); }

  const idioma = nameFor(DESTINO);
  console.log(`\n🌎 "${book.title}" → ${idioma} (voz ${VOZ})`);

  // 1) Traducción: si ya existe en R2, se reusa (la pudo hacer un lector).
  const ruta = `traducciones/${book.gutenbergId}-${DESTINO}.txt`;
  let traducido = await r2GetText(ruta);

  if (traducido) {
    console.log(`   ✓ Traducción ya existente (${(traducido.length / 1024).toFixed(0)} KB), la reuso.`);
  } else {
    const crudo = await textoGutenberg(book.gutenbergId);
    if (!crudo) throw new Error("No pude bajar el texto de Gutenberg ni de sus espejos.");
    const texto = stripGutenbergBoilerplate(crudo).replace(/_/g, "");
    if (texto.length > MAX_CHARS) {
      console.log(`   ⏭️  Muy largo (${texto.length.toLocaleString("es-AR")} chars). Salteado.`);
      await prisma.$disconnect();
      process.exit(2);
    }
    const partes = chunkText(texto);
    console.log(`   📖 ${(texto.length / 1024).toFixed(0)} KB · ${partes.length} fragmentos a traducir`);
    const out: string[] = new Array(partes.length);
    for (let i = 0; i < partes.length; i += CONCURRENCIA) {
      const lote = partes.slice(i, i + CONCURRENCIA);
      // Si un fragmento falla se conserva el original: es mejor un párrafo en
      // inglés en medio del libro que perder toda la traducción.
      const r = await Promise.all(lote.map((c, k) => traducirParte(c, idioma).catch(() => partes[i + k])));
      r.forEach((x, k) => (out[i + k] = x));
      process.stdout.write(`   traduciendo ${Math.min(i + CONCURRENCIA, partes.length)}/${partes.length}\r`);
    }
    traducido = out.join("\n\n");
    await r2Put(ruta, Buffer.from(traducido, "utf8"), "text/plain; charset=utf-8");
    console.log(`\n   ✓ Traducción lista y cacheada para los lectores.`);
  }

  // 2) Narración de la traducción.
  const { body } = splitFrontMatterAndBody(traducido);
  const tts = new EdgeTTSProvider({ language: DESTINO });
  const partes = chunkText(body);
  const bufs: Buffer[] = [];
  for (let i = 0; i < partes.length; i++) {
    process.stdout.write(`   narrando ${i + 1}/${partes.length}\r`);
    bufs.push(await tts.generate(partes[i], { voice: VOZ, speed: Number(process.env.TTS_SPEED ?? 1.05) }));
    await sleep(80);
  }
  const audio = Buffer.concat(bufs);
  const url = await r2Put(`audiolibro/${SLUG}-${DESTINO}-${VOZ}.mp3`, audio, "audio/mpeg");
  console.log(`\n   ✓ Audio ${(audio.length / 1024 / 1024).toFixed(1)} MB → ${url}`);

  // 3) Registrar la versión CON su idioma, que es lo que permite a la ficha elegir
  //    la grabación correcta según lo que el lector esté leyendo.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let versions: any[] = JSON.parse(book.audioVersions ?? "[]");
  versions = versions.filter((v) => !(v.voiceId === VOZ && v.language === DESTINO));
  versions.push({
    voiceId: VOZ,
    voiceName: `${VOZ === "onyx" ? "Onyx · voz masculina" : "Nova · voz femenina"} (${idioma})`,
    language: DESTINO,
    youtubeVideoId: null,
    youtubePublic: false,
    audioUrl: url,
    durationSeconds: Math.round(body.length / 900) * 60,
    status: "ready",
  });
  await prisma.book.update({ where: { slug: SLUG }, data: { audioVersions: JSON.stringify(versions) } });

  if (process.env.PATCH_OUT) {
    const { readFile, writeFile } = await import("node:fs/promises");
    const previos: { slug: string; audioVersions?: string }[] = await readFile(process.env.PATCH_OUT, "utf8").then((t) => JSON.parse(t)).catch(() => []);
    const acc = new Map(previos.map((p) => [p.slug, p]));
    acc.set(SLUG, { slug: SLUG, audioVersions: JSON.stringify(versions) });
    await writeFile(process.env.PATCH_OUT, JSON.stringify([...acc.values()], null, 2), "utf8");
  }

  console.log(`\n✅ "${book.title}" ahora se lee Y se escucha en ${idioma}.\n`);
}

main().catch((e) => { console.error("\n✗", e.message); process.exit(1); }).finally(() => prisma.$disconnect());
