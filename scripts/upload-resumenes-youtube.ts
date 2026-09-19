// Sube los audios de RESÚMENES (modernos + clásicos) a YouTube como videos
// (tapa + audio). Cada video queda PÚBLICO desde el vamos (auditoría aprobada)
// con descripción rica, tags y link de compra (Amazon afiliado) cuando aplica.
// Guarda el videoId en el summary del libro para que la web use el embed.
// Idempotente. Prioriza los que ya tienen audio en R2 y no tienen videoId aún.
//
// Uso:   REQ_LIMIT=3 npx tsx scripts/upload-resumenes-youtube.ts
import "dotenv/config";
import { prisma, sleep } from "./db";
import { makeVideo } from "./lib/video";
import { uploadVideo, titulosPublicados, normalizarTitulo, asegurarPlaylist, agregarAPlaylist, playlistPara } from "./lib/youtube";
import { r2GetText, r2Put } from "../src/lib/r2";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "node:stream";
import type { Language } from "../src/lib/types";

const LIMIT = Number(process.env.REQ_LIMIT ?? 3);
// Tope de reloj opcional (minutos). El motor diario lo usa para que las subidas no se
// coman todo su turno: cada video tarda 2-3 min entre bajar audio, armar y subir.
const MAX_MS = Number(process.env.YT_MAX_MIN ?? 0) * 60_000;
const INICIO = Date.now();
const SITE = "https://biblioteca-audiolibros.vercel.app";
// Para subidas puntuales que tienen que saltear la cola: re-subir un video que salió
// mal, o empujar un título concreto. Sin esto hay que esperar el turno por orden de
// capa, y con 60+ libros en cola eso son semanas.
// YT_SIMULAR=1 → muestra título y descripción de lo que subiría, sin subir nada.
const SIMULAR = process.env.YT_SIMULAR === "1";
const SOLO_SLUGS = (process.env.SOLO_SLUGS ?? "").split(",").map((s) => s.trim()).filter(Boolean);

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! },
});

// Baja un mp3 de R2 al disco local (para pasárselo a ffmpeg).
async function downloadFromR2(key: string, dest: string): Promise<void> {
  const res = await s3.send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key }));
  const chunks: Buffer[] = [];
  const stream = res.Body as Readable;
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  await writeFile(dest, Buffer.concat(chunks));
}

// Extrae la key de R2 de una URL pública.
function keyFromUrl(url: string): string {
  const pub = (process.env.R2_PUBLIC_URL ?? "").replace(/\/+$/, "");
  return url.startsWith(pub) ? url.slice(pub.length + 1) : url;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pickAudioToUpload(book: any): { lang: Language; url: string; voice: "onyx" | "nova" } | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let s: any; try { s = JSON.parse(book.summary ?? "{}"); } catch { return null; }
  // SOLO español. El canal es hispanohablante: los resúmenes en inglés que se
  // subieron antes quedaron como videos ajenos al público del canal. Los títulos
  // originales en inglés ahora se generan con ficha en español (negocios-modernos.ts).
  for (const lang of ["es"] as Language[]) {
    const r = s[lang]?.resumen;
    if (!r?.text || !r.audio) continue;
    if (r.youtubeVideoId) continue; // ya subido
    const audio = r.audio.onyx ?? r.audio.nova;
    if (!audio) continue;
    return { lang, url: audio, voice: r.audio.onyx ? "onyx" : "nova" };
  }
  return null;
}

// Título con el que se conoce la obra en español. Los clásicos están cargados con su
// título original ("Pride and Prejudice") y el canal es en español: un video titulado
// en inglés no lo encuentra quien busca "Orgullo y prejuicio". Se pide una vez y
// queda guardado en el summary (es.tituloEs) para no volver a gastar en eso.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function tituloEspanol(book: any): Promise<{ titulo: string; autor: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let s: any; try { s = JSON.parse(book.summary ?? "{}"); } catch { s = {}; }
  if (s.es?.tituloEs) return { titulo: s.es.tituloEs, autor: s.es.autorEs ?? book.author };
  const tal = { titulo: book.title, autor: book.author };
  if (book.language === "es" || book.contentLayer === 2 || !process.env.OPENAI_API_KEY) return tal;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini", temperature: 0, max_tokens: 80,
      messages: [
        { role: "system", content: "Respondés SOLO dos líneas: el título y el autor. Sin comillas ni explicaciones." },
        { role: "user", content:
          `¿Con qué título se publica en español "${book.title}" de ${book.author}? ` +
          `Si tiene un título establecido en español, devolvé ese. Si no, una traducción fiel y breve. ` +
          `Sin subtítulos de catálogo, sin "Volumen"/"Tomo" salvo que sea parte del nombre. ` +
          `Segunda línea: el nombre del autor como se escribe habitualmente en español (ej. Homero, Fiódor Dostoievski; ` +
          `si no cambia, igual al original).` },
      ],
    }),
  });
  if (!res.ok) return tal;
  const limpiar = (x: string) => (x ?? "").trim().replace(/^(t[ií]tulo|autor)\s*:\s*/i, "").replace(/^["“«']+|["”»'.]+$/g, "");
  const [t, a] = String((await res.json()).choices?.[0]?.message?.content ?? "").split("\n").map(limpiar).filter(Boolean);
  if (!t || t.length > 90) return tal;
  const autor = a && a.length <= 60 ? a : book.author;
  s.es = { ...(s.es ?? {}), tituloEs: t, autorEs: autor };
  book.summary = JSON.stringify(s);
  await prisma.book.update({ where: { id: book.id }, data: { summary: book.summary } });
  return { titulo: t, autor };
}

// ¿Tiene el libro completo narrado en español? Define qué promete el video.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tieneCompletoEs(book: any): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let a: any[]; try { a = JSON.parse(book.audioVersions ?? "[]"); } catch { return false; }
  return a.some((v) => v.status === "ready" && (v.language ?? book.language) === "es");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildMetadataClasico(book: any, es: { titulo: string; autor: string }) {
  const tituloEs = es.titulo;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let s: any; try { s = JSON.parse(book.summary ?? "{}"); } catch { s = {}; }
  const palabras = String(s.es?.resumen?.text ?? "").split(/\s+/).length;
  const minutos = Math.max(5, Math.round(palabras / 150 / 5) * 5);
  const original = tituloEs !== book.title ? ` (título original: ${book.title})` : "";
  const completo = tieneCompletoEs(book)
    ? `🎧 El AUDIOLIBRO COMPLETO en español, gratis, y el texto entero: ${SITE}/libro/${book.slug}`
    : `📖 El libro completo gratis (texto) y más audiolibros: ${SITE}/libro/${book.slug}`;
  const title = `${tituloEs} — Resumen · ${es.autor}`.slice(0, 100);
  const description = [
    `${tituloEs}, de ${es.autor}${original}.`,
    ``,
    `Resumen narrado en español, de unos ${minutos} minutos: la historia, los personajes y por qué este clásico sigue vigente.`,
    ``,
    completo,
    ``,
    `Es una obra de dominio público: en Biblioteca Abierta la podés escuchar y leer entera, sin registrarte y sin pagar.`,
    ``,
    `#audiolibro #resumen #clasicos #literatura #audiolibrosenespañol`,
  ].join("\n");
  const tags = ["resumen", "audiolibro", "audiolibro en español", "clásicos", "literatura", tituloEs, book.title, es.autor, book.author].slice(0, 15);
  return { title, description, tags, voiceLabel: "voz Onyx" };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildMetadata(book: any, lang: Language) {
  const isEs = lang === "es";
  const voiceLabel = "voz Onyx";
  const title = `${book.title} — Resumen · ${book.author}`.slice(0, 100);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cats: string[] = []; try { cats = JSON.parse(book.categories ?? "[]"); } catch { /* */ }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let affs: {store:string,url:string}[] = []; try { affs = JSON.parse(book.affiliateLinks ?? "[]"); } catch { /* */ }
  // La descripción NO lleva link directo a la tienda: manda a la ficha, y la ficha
  // arma el link de afiliado al renderizar (withAffiliateTag). Así el día que el tag
  // de Associates esté cargado, TODOS los videos ya subidos empiezan a cobrar sin
  // tener que editar una sola descripción — editarlas por API exige el scope
  // `youtube` completo, que mandaría la app a verificación de Google otra vez.
  const hasStore = affs.length > 0;
  const disclaimer = isEs
    ? "Este es un análisis original de las ideas centrales de la obra, con nuestras palabras. NO reproduce el texto del libro. Para la experiencia completa, comprá la edición original."
    : "This is an original analysis of the book's central ideas, in our own words. It does NOT reproduce the book's text. For the full experience, get the original edition.";
  const description = [
    `${book.title}, de ${book.author}.`,
    ``,
    `Análisis extenso (~40 min) de las ideas centrales de este best-seller, narrado con IA.`,
    ``,
    `📖 Análisis completo en texto y audio, y más libros: ${SITE}/libro/${book.slug}`,
    ...(hasStore
      ? [
          ``,
          `🛒 En esa misma página está el link para conseguir el libro original.`,
          `(Comprándolo desde ahí apoyás la biblioteca, sin costo extra para vos.)`,
        ]
      : []),
    ``,
    disclaimer,
    ``,
    `#audiolibro #resumenlibros #desarrollopersonal #${cats.map(c=>c.replace(/[^\p{L}\p{N}]/gu,'').toLowerCase()).slice(0,3).join(' #')}`,
  ].join("\n");
  const tags = ["resumen", "libro", "audiolibro", book.author, ...cats].slice(0, 15);
  return { title, description, tags, voiceLabel };
}

// Puntaje de demanda: define en qué se gastan las subidas diarias (la cuota manda).
// Las visitas pesan mucho más que las descargas para que, cuando el sitio tenga
// tráfico propio, esa señal se imponga sola sin tener que retocar nada acá.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function prioridad(b: any): number {
  const visitas = (b.viewsCached ?? 0) * 10_000;
  const nichoNegocios = b.contentLayer === 2 ? 5_000_000 : 0;
  // Entre los clásicos, primero los que ya tienen el AUDIOLIBRO COMPLETO en español:
  // ese video manda a algo entero para escuchar, no solo a un texto en inglés.
  const completoEs = tieneCompletoEs(b) ? 1_000_000 : 0;
  return visitas + nichoNegocios + completoEs + (b.downloadCount ?? 0);
}

// ---------- Registro de subidas (a prueba de duplicados) ----------
// El videoId se guardaba SOLO en el catálogo, y el catálogo llega al repo recién al
// final del job, con un commit. Cuando ese guardado falló (pasó varios días seguidos),
// el motor no se enteraba de lo que ya había subido y lo volvía a subir: el canal
// llegó a tener el mismo resumen 7 veces.
// Ahora cada subida se anota en R2 en el MISMO momento en que YouTube devuelve el
// videoId, y antes de subir se consulta. Es independiente de git: aunque el guardado
// del catálogo falle, el libro no se vuelve a subir. Clave: "slug:idioma".
const REGISTRO = "youtube/subidos.json";
type Registro = Record<string, string>;

async function leerRegistro(): Promise<Registro> {
  const txt = await r2GetText(REGISTRO);
  if (txt === null) {
    // Si no existe, NO se asume vacío: sin registro no hay protección contra duplicados.
    throw new Error(`No encuentro ${REGISTRO} en R2. No subo nada a ciegas.`);
  }
  return JSON.parse(txt) as Registro;
}

async function anotar(reg: Registro, clave: string, videoId: string): Promise<void> {
  reg[clave] = videoId;
  await r2Put(REGISTRO, JSON.stringify(reg, null, 1), "application/json");
}

// ¿El error es de cuota? YouTube lo informa con distintos "reasons" según el caso.
function esCuota(msg: string): boolean {
  return /quota|uploadLimitExceeded|rateLimitExceeded|dailyLimitExceeded/i.test(msg);
}

async function main() {
  if (!process.env.GOOGLE_REFRESH_TOKEN) throw new Error("Falta GOOGLE_REFRESH_TOKEN (correr scripts/youtube-auth.ts)");
  if (!process.env.R2_BUCKET) throw new Error("Falta R2 config.");

  // Traer todos los libros con audio de resumen (contentLayer 1 o 2), que no tengan videoId ya.
  const all = await prisma.book.findMany({
    where: { AND: [{ status: "published" }, { OR: [{ contentLayer: 1 }, { contentLayer: 2 }] }] },
  });
  // La cuota de YouTube es limitada: en qué se gastan las subidas importa más que
  // cuántas son. Antes el orden era "capa 1 primero", que dejaba el nicho de
  // negocios —el único con links de afiliado y el más buscado— detrás de 60 clásicos.
  //
  // Prioridad, de mayor a menor peso:
  //   1. Visitas reales en el sitio. Es la única señal de demanda PROPIA; hoy casi
  //      todos están en cero, pero a medida que llegue tráfico manda esta sola.
  //   2. Modernos de negocios: se buscan mucho y son los que generan ingresos.
  //   3. Descargas en Gutenberg: buen proxy de popularidad mientras no haya tráfico.
  all.sort((a, b) => prioridad(b) - prioridad(a));

  // Lo que el registro dice que ya está en YouTube se vuelca al catálogo (así la web
  // lo muestra aunque aquel guardado se haya perdido) y deja de ser candidato.
  const registro = await leerRegistro();
  let recuperados = 0;
  for (const b of all) {
    const id = registro[`${b.slug}:es`];
    if (!id) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let s: any; try { s = JSON.parse(b.summary ?? "{}"); } catch { continue; }
    if (!s.es?.resumen || s.es.resumen.youtubeVideoId === id) continue;
    s.es.resumen.youtubeVideoId = id;
    s.es.resumen.youtubePublic = true;
    b.summary = JSON.stringify(s);
    await prisma.book.update({ where: { id: b.id }, data: { summary: b.summary } });
    recuperados++;
  }
  if (recuperados) console.log(`↺ ${recuperados} videoId(s) recuperados del registro de R2 al catálogo.`);
  // Los tomos sueltos ("Oliver Twist, Vol. 2 (of 3)") quedan afuera: el video diría
  // "Oliver Twist — Resumen" y resumiría solo un pedazo de la obra.
  const esTomo = (b: { title: string }) => /\b(vol\.?|volume|tomo)\s*\d/i.test(b.title);
  const listos = all.filter((b) => !esTomo(b) && !!pickAudioToUpload(b));
  const elegibles = SOLO_SLUGS.length ? listos.filter((b) => SOLO_SLUGS.includes(b.slug)) : listos;
  const pend = elegibles.slice(0, LIMIT);
  const filtro = SOLO_SLUGS.length ? ` · filtrando ${SOLO_SLUGS.length} slug(s)` : "";
  console.log(`\n📺 A subir a YouTube: ${pend.length} (de ${listos.length} pendientes${filtro})\n`);
  if (SOLO_SLUGS.length) {
    const faltantes = SOLO_SLUGS.filter((s) => !elegibles.some((b) => b.slug === s));
    if (faltantes.length) console.log(`   ⚠️  sin audio pendiente (los salteo): ${faltantes.join(", ")}\n`);
  }

  let done = 0;
  const errores: string[] = [];
  // Con la cuota ampliada, el motor pide muchos videos por corrida y el techo real
  // lo pone YouTube. Cuando la cuota se agota hay que CORTAR: cada intento baja el
  // audio de R2 y arma el mp4 (2-3 min) antes de enterarse de que no puede subir.
  let cuotaAgotada = false;
  // Segunda barrera: lo que el canal YA muestra no se sube, aunque registro y
  // catálogo digan otra cosa. Si no se puede leer el canal, no se sube a ciegas.
  const enCanal = SIMULAR ? new Map<string, string>() : await titulosPublicados();
  if (!SIMULAR) console.log(`🔎 Canal: ${enCanal.size} videos públicos leídos para evitar repetidos.`);
  for (const book of pend) {
    if (MAX_MS && Date.now() - INICIO > MAX_MS) {
      console.log(`\n⏱  Tope de ${MAX_MS / 60_000} min alcanzado. El resto sube en la próxima corrida.`);
      break;
    }
    const pick = pickAudioToUpload(book);
    if (!pick) continue;
    console.log(`\n→ ${book.slug} [${pick.lang}/${pick.voice}]`);
    if (SIMULAR) {
      const meta = book.contentLayer === 1 ? buildMetadataClasico(book, await tituloEspanol(book)) : buildMetadata(book, pick.lang);
      console.log(`  [simulación] ${meta.title}\n${meta.description.split("\n").map((l) => "    | " + l).join("\n")}`);
      done++;
      continue;
    }
    const meta = book.contentLayer === 1
      ? buildMetadataClasico(book, await tituloEspanol(book))
      : buildMetadata(book, pick.lang);
    const yaEsta = enCanal.get(normalizarTitulo(meta.title));
    if (yaEsta) {
      console.log(`  ⏭️  ya está en el canal (${yaEsta}): lo anoto y no lo subo de nuevo.`);
      await anotar(registro, `${book.slug}:${pick.lang}`, yaEsta);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s: any = JSON.parse(book.summary ?? "{}");
      s[pick.lang].resumen.youtubeVideoId = yaEsta;
      s[pick.lang].resumen.youtubePublic = true;
      await prisma.book.update({ where: { id: book.id }, data: { summary: JSON.stringify(s) } });
      continue;
    }
    const dir = await mkdtemp(path.join(tmpdir(), "ytup-"));
    const audioPath = path.join(dir, "audio.mp3");
    const videoPath = path.join(dir, "video.mp4");
    try {
      const key = keyFromUrl(pick.url);
      console.log("  · descargando audio de R2...");
      await downloadFromR2(key, audioPath);
      console.log("  · armando mp4 (tapa + audio)...");
      await makeVideo({ coverUrl: book.coverImageUrl, slug: book.slug, audioPath, outPath: videoPath });
      console.log(`  · subiendo a YouTube ("${meta.title.slice(0, 50)}")...`);
      const videoId = await uploadVideo({
        videoPath, title: meta.title, description: meta.description, tags: meta.tags,
        language: pick.lang, privacyStatus: "public",
      });
      console.log(`  ✓ videoId: ${videoId} → https://youtu.be/${videoId}`);
      // Primero el registro durable; si no se puede anotar, se corta la corrida:
      // seguir subiendo sin poder registrar es exactamente cómo se generan duplicados.
      try {
        await anotar(registro, `${book.slug}:${pick.lang}`, videoId);
      } catch (e) {
        console.error(`  ✗ Subido pero NO pude anotarlo en R2 (${(e as Error).message}). Corto para no duplicar.`);
        await prisma.book.update({ where: { id: book.id }, data: { summary: (() => { const s = JSON.parse(book.summary ?? "{}"); s[pick.lang].resumen.youtubeVideoId = videoId; s[pick.lang].resumen.youtubePublic = true; return JSON.stringify(s); })() } });
        process.exit(1);
      }

      // Marcar en el summary
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s: any = JSON.parse(book.summary ?? "{}");
      s[pick.lang].resumen.youtubeVideoId = videoId;
      s[pick.lang].resumen.youtubePublic = true;
      await prisma.book.update({ where: { id: book.id }, data: { summary: JSON.stringify(s) } });
      done++;
      enCanal.set(normalizarTitulo(meta.title), videoId);
      // Lista de reproducción por tipo. Si falla no pasa nada grave: el video ya está.
      try {
        const pl = playlistPara(book.contentLayer);
        await agregarAPlaylist(await asegurarPlaylist(pl.titulo, pl.descripcion), videoId);
        console.log(`  ✓ agregado a la lista "${pl.titulo}"`);
      } catch (e) {
        console.error(`  ⚠️  no pude agregarlo a la lista: ${(e as Error).message}`);
      }
      await sleep(300);
    } catch (e) {
      const msg = (e as Error).message;
      if (esCuota(msg)) {
        cuotaAgotada = true;
        console.log(`  ⏸  YouTube: cuota diaria agotada. Corto acá; el resto sube mañana.`);
      } else {
        errores.push(`${book.slug}: ${msg}`);
        console.error(`  ✗ ${msg}`);
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
    console.log(`  (${done}/${pend.length})`);
    if (cuotaAgotada) break;
  }
  if (errores.length) {
    console.error(`\n⚠️  ${errores.length} fallaron:`);
    for (const e of errores) console.error(`   · ${e}`);
  }
  // Si había candidatos y no subió NINGUNO, es un fallo, no un éxito de cero. Sin
  // esto la corrida quedaba en verde informando "Subidos 0 videos" y el canal
  // estuvo semanas sin recibir nada mientras todo parecía funcionar.
  // Quedarse sin cuota NO es un fallo: es el techo del día. Se informa y listo.
  // Sí es fallo que no entre nada por cualquier OTRA razón (credenciales, R2...):
  // esa fue la causa de semanas sin subidas mientras todo figuraba en verde.
  if (pend.length > 0 && done === 0 && !cuotaAgotada) {
    console.error(`\n✗ Había ${pend.length} para subir y no entró ninguno.`);
    process.exit(1);
  }
  const techo = cuotaAgotada ? " · techo de cuota alcanzado" : "";
  console.log(`\n✅ Subidos ${done} videos a YouTube${techo}.\n`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
