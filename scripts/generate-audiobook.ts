// Genera UN audiolibro de prueba con TTS (Fase 3), con control de costo.
// - Baja el texto del libro desde Project Gutenberg.
// - Saca el andamiaje legal y ARRANCA EN EL CAPÍTULO 1 (saltea el prólogo).
// - Corta en fragmentos, narra cada uno con OpenAI (voz onyx/nova) y los une.
// - Guarda el mp3 en public/audio/ y lo deja reproducible en la ficha.
//
// Necesita OPENAI_API_KEY en el entorno (.env).
//
// Uso:
//   npx tsx scripts/generate-audiobook.ts                       # Don Quijote, voz onyx
//   npx tsx scripts/generate-audiobook.ts frankenstein nova
//   TTS_MAX_CHARS=12000 npx tsx scripts/generate-audiobook.ts   # más largo (más caro)
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma, sleep, fetchRetry } from "./db";
import { OpenAITTSProvider } from "../src/lib/tts/openai";
import { EdgeTTSProvider } from "../src/lib/tts/edge";
import {
  stripGutenbergBoilerplate,
  splitFrontMatterAndBody,
  chunkText,
} from "../src/lib/tts/text";
import { estimateCost, formatEstimate } from "../src/lib/tts/cost";
import type { TTSProvider, TTSVoiceId } from "../src/lib/tts/types";
import type { Language } from "../src/lib/types";

const SLUG = process.argv[2] ?? "don-quijote-de-la-mancha";
const VOICE = (process.argv[3] ?? "onyx") as TTSVoiceId;
// Proveedor de voz: "edge" = GRATIS (Microsoft, por defecto) | "openai" = premium (paga).
const PROVIDER = process.env.TTS_PROVIDER ?? "edge";
// Tope de caracteres. 0 = libro COMPLETO (sin tope).
const MAX_CHARS = Number(process.env.TTS_MAX_CHARS ?? 6000);
const SPEED = Number(process.env.TTS_SPEED ?? 1.07); // un toque más ágil (Nico: no lento)
const INSTRUCTIONS =
  "Narrá como un audiolibro profesional: voz cálida, clara y con buen ritmo " +
  "(ni lento ni monótono), entonación natural y expresiva, como un buen " +
  "cuentista. No leas títulos de sección ni notas al pie.";

async function main() {
  const book = await prisma.book.findUnique({ where: { slug: SLUG } });
  if (!book) throw new Error(`No existe el libro con slug "${SLUG}".`);
  if (!book.gutenbergId) throw new Error(`"${SLUG}" no tiene gutenbergId (no es Capa 1).`);

  console.log(`\n🎙️  Generando narrado de "${book.title}" — voz ${VOICE}.`);

  // 1) Texto plano de Gutenberg
  const id = book.gutenbergId;
  const txtUrl = `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`;
  const res = await fetchRetry(txtUrl, { tries: 4, timeoutMs: 45000 });
  if (!res || !res.ok) throw new Error(`No pude bajar el texto (${txtUrl}).`);
  const raw = await res.text();

  // 2) Sacar andamiaje + arrancar en el Capítulo 1
  const clean = stripGutenbergBoilerplate(raw);
  const { frontMatter, body } = splitFrontMatterAndBody(clean);
  console.log(
    `   Prólogo/preliminares detectados: ${frontMatter ? `${frontMatter.length} chars (se omiten del narrado)` : "no"}.`,
  );
  const toNarrate = MAX_CHARS > 0 ? body.slice(0, MAX_CHARS) : body;

  // 3) Control de costo (edge-tts es GRATIS; OpenAI cobra por uso)
  const est = estimateCost(toNarrate.length);
  const costLabel =
    PROVIDER === "edge"
      ? `${toNarrate.length.toLocaleString("es-AR")} caracteres ≈ ${est.minutes} min de audio · GRATIS (edge-tts)`
      : formatEstimate(est);
  console.log(`   Voz: ${PROVIDER}. Narra: ${costLabel}.`);

  // 4) Generar audio por fragmentos
  const chunks = chunkText(toNarrate);
  console.log(`   ${chunks.length} fragmentos a narrar...`);
  const tts: TTSProvider =
    PROVIDER === "openai"
      ? new OpenAITTSProvider()
      : new EdgeTTSProvider({ language: book.language as Language });
  const buffers: Buffer[] = [];
  for (let i = 0; i < chunks.length; i++) {
    process.stdout.write(`   · fragmento ${i + 1}/${chunks.length}\r`);
    const buf = await tts.generate(chunks[i], {
      voice: VOICE,
      speed: SPEED,
      instructions: INSTRUCTIONS,
    });
    buffers.push(buf);
    await sleep(200);
  }
  const audio = Buffer.concat(buffers);

  // 5) Guardar en public/audio y dejarlo reproducible en la ficha
  const dir = path.join(process.cwd(), "public", "audio");
  await mkdir(dir, { recursive: true });
  const fileName = `${SLUG}-${VOICE}.mp3`;
  await writeFile(path.join(dir, fileName), audio);
  const audioUrl = `/audio/${fileName}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let versions: any[] = [];
  try {
    versions = JSON.parse(book.audioVersions ?? "[]");
  } catch {
    versions = [];
  }
  versions = versions.filter((v) => v.voiceId !== VOICE);
  versions.unshift({
    voiceId: VOICE,
    voiceName: VOICE === "onyx" ? "Onyx · voz masculina" : "Nova · voz femenina",
    youtubeVideoId: null,
    audioUrl,
    durationSeconds: Math.round(est.minutes * 60),
    status: "ready",
  });
  await prisma.book.update({
    where: { id: book.id },
    data: { audioVersions: JSON.stringify(versions) },
  });

  console.log(
    `\n✅ Listo. Audio guardado en public${audioUrl} (${(audio.length / 1024 / 1024).toFixed(2)} MB).` +
      `\n   Ya es reproducible en la ficha /libro/${SLUG}.` +
      `\n   Acordate de actualizar el snapshot: npx tsx scripts/export-seed.ts\n`,
  );
}

main()
  .catch((e) => {
    console.error("\n✗", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
