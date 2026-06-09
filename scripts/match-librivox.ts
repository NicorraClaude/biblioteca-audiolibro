// Match con LibriVox — marca qué títulos de Capa 1 YA tienen una grabación de
// audio de dominio público (costo $0) y la deja REPRODUCIBLE (embed de archive.org),
// para no generarla con TTS (Fase 3).
// API pública de LibriVox, búsqueda por título con prefijo "^" (empieza con).
//
// Uso:  npx tsx scripts/match-librivox.ts
import { prisma, sleep, fetchRetry } from "./db";
import { normalize } from "../src/lib/text";

// ¿El título de LibriVox y el nuestro son "el mismo libro"? Comparación laxa
// sin acentos: uno contiene al otro (descartando subtítulos tras ":" ";" "(").
function titlesMatch(ours: string, theirs: string): boolean {
  const a = normalize(ours.split(/[:;(]/)[0]);
  const b = normalize(theirs.split(/[:;(]/)[0]);
  if (a.length < 4 || b.length < 4) return false;
  return a.includes(b) || b.includes(a);
}

// Partículas que NO sirven para identificar a un autor.
const STOP = new Set([
  "de", "del", "la", "el", "los", "las", "von", "van", "the", "y", "de la",
  "condesa", "sir", "mr", "mrs", "dr", "saint", "san",
]);

function authorTokens(name: string): Set<string> {
  return new Set(
    normalize(name)
      .split(/[\s,.]+/)
      .filter((t) => t.length >= 4 && !STOP.has(t)),
  );
}

// ¿Es el MISMO autor? Comparten al menos un token significativo de apellido.
// Evita falsos positivos tipo "Cuentos de amor" (Pardo Bazán) ↔ "Cuentos" (Quiroga).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function authorsMatch(ourAuthor: string, lvAuthors: any[]): boolean {
  const ours = authorTokens(ourAuthor);
  if (ours.size === 0) return false; // autor desconocido → no arriesgamos
  for (const a of lvAuthors ?? []) {
    const theirs = authorTokens(`${a.first_name ?? ""} ${a.last_name ?? ""}`);
    for (const t of theirs) if (ours.has(t)) return true;
  }
  return false;
}

// "8:16:48" → 29808 segundos
function parseDuration(t: string | undefined): number | null {
  if (!t) return null;
  const parts = t.split(":").map(Number);
  if (parts.some(Number.isNaN)) return null;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

// "https://www.archive.org/details/frankenstein_shelley" → "frankenstein_shelley"
function archiveIdFrom(url: string | undefined): string | null {
  if (!url) return null;
  const m = url.match(/\/details\/([^/?#]+)/);
  return m ? m[1] : null;
}

async function main() {
  const books = await prisma.book.findMany({
    where: { contentLayer: 1, librivoxUrl: null },
    orderBy: { downloadCount: "desc" },
  });
  console.log(`\n🎙️  Match LibriVox — ${books.length} títulos a chequear.\n`);

  let matched = 0;
  let playable = 0;

  for (let idx = 0; idx < books.length; idx++) {
    const book = books[idx];
    const titleQuery = book.title.split(/[:;(]/)[0].trim();
    const url = `https://librivox.org/api/feed/audiobooks/?title=${encodeURIComponent(
      "^" + titleQuery,
    )}&format=json&extended=1&limit=5`;
    const res = await fetchRetry(url, { tries: 3, timeoutMs: 20000 });
    await sleep(500); // gentileza con LibriVox

    if (!res || !res.ok) continue; // 404 = no encontrado
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      continue;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const list: any[] = (data as any)?.books ?? [];
    // Match real: título Y autor. Exigir ambos evita pegar el audio equivocado.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hit = list.find(
      (lb: any) =>
        titlesMatch(book.title, lb.title ?? "") &&
        authorsMatch(book.author, lb.authors ?? []),
    );
    if (!hit) continue;

    const librivoxUrl: string | null = hit.url_librivox || null;
    const archiveId = archiveIdFrom(hit.url_iarchive);
    const durationSeconds = parseDuration(hit.totaltime);

    // Si hay grabación en archive.org, la dejamos como versión de audio "ready"
    // (reproducible ya). Va PRIMERO, antes de las voces TTS pendientes.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let versions: any[] = [];
    try {
      versions = JSON.parse(book.audioVersions ?? "[]");
    } catch {
      versions = [];
    }
    versions = versions.filter((v) => v.voiceId !== "librivox");
    if (archiveId) {
      versions.unshift({
        voiceId: "librivox",
        voiceName: "Grabación LibriVox (voces reales)",
        youtubeVideoId: null,
        archiveId,
        durationSeconds,
        status: "ready",
      });
      playable++;
    }

    await prisma.book.update({
      where: { id: book.id },
      data: {
        librivoxUrl,
        audioVersions: JSON.stringify(versions),
      },
    });
    matched++;
    if (matched % 5 === 0) {
      console.log(`  ${matched} matches (${playable} reproducibles) · ${idx + 1}/${books.length} chequeados`);
    }
  }

  console.log(
    `\n✅ Match LibriVox listo. ${matched}/${books.length} con grabación` +
      ` (${playable} reproducibles ya vía archive.org).\n`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
