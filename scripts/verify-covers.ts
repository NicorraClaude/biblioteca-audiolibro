// Verifica TODAS las tapas: vuelve a buscar en Open Library exigiendo que el
// resultado coincida en TÍTULO y AUTOR con nuestro libro, y que la imagen cargue.
// Si no hay match confiable → coverImageUrl = null (usa la tapa diseñada, siempre
// correcta). Así eliminamos tapas equivocadas (libro/edición errónea).
//
// Uso:  npx tsx scripts/verify-covers.ts
import { prisma, sleep, fetchRetry } from "./db";
import { normalize } from "../src/lib/text";

const STOP = new Set([
  "de", "del", "la", "el", "los", "las", "von", "van", "the", "and", "y",
  "condesa", "sir", "mr", "mrs", "dr", "saint", "san", "edward", "morgan",
]);
function tokens(s: string): Set<string> {
  return new Set(normalize(s).split(/[\s,.]+/).filter((t) => t.length >= 4 && !STOP.has(t)));
}
function titleOk(ours: string, theirs: string): boolean {
  const a = normalize(ours.split(/[:;(]/)[0]);
  const b = normalize((theirs ?? "").split(/[:;(]/)[0]);
  if (a.length < 3 || b.length < 3) return false;
  return a === b || a.includes(b) || b.includes(a);
}
function authorOk(ourAuthor: string, names: string[]): boolean {
  const ours = tokens(ourAuthor);
  if (ours.size === 0) return false;
  for (const n of names ?? []) {
    for (const t of tokens(n)) if (ours.has(t)) return true;
  }
  return false;
}

// La imagen de OL existe y no es el placeholder vacío (filtra por tamaño).
async function imageOk(url: string): Promise<boolean> {
  const res = await fetchRetry(url, { tries: 2, timeoutMs: 20000 });
  if (!res || !res.ok) return false;
  const type = res.headers.get("content-type") ?? "";
  if (!type.startsWith("image/")) return false;
  // OL no manda content-length: medimos los bytes reales (<3KB = placeholder).
  const buf = await res.arrayBuffer();
  return buf.byteLength > 3000;
}

async function main() {
  const books = await prisma.book.findMany({ where: { contentLayer: 1 }, orderBy: { downloadCount: "desc" } });
  console.log(`\n🔎 Verificando tapas de ${books.length} libros...\n`);

  let real = 0, designed = 0, fixed = 0;
  for (let i = 0; i < books.length; i++) {
    const b = books[i];
    const q =
      `https://openlibrary.org/search.json?title=${encodeURIComponent(b.title.split(/[:;(]/)[0].trim())}` +
      `&author=${encodeURIComponent(b.author)}&limit=5&fields=title,author_name,cover_i`;
    const res = await fetchRetry(q, { tries: 3, timeoutMs: 20000 });
    await sleep(300);

    let coverUrl: string | null = null;
    if (res && res.ok) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const docs: any[] = (await res.json())?.docs ?? [];
        const match = docs.find(
          (d) => d.cover_i && titleOk(b.title, d.title) && authorOk(b.author, d.author_name ?? []),
        );
        if (match) {
          const url = `https://covers.openlibrary.org/b/id/${match.cover_i}-L.jpg`;
          if (await imageOk(url)) coverUrl = url;
        }
      } catch {
        /* sigue */
      }
    }

    if (coverUrl) real++;
    else designed++;
    if (b.coverImageUrl !== coverUrl) {
      await prisma.book.update({ where: { id: b.id }, data: { coverImageUrl: coverUrl } });
      fixed++;
    }
    if ((i + 1) % 20 === 0) console.log(`  ${i + 1}/${books.length} · ${real} reales · ${designed} diseñadas · ${fixed} corregidas`);
  }

  console.log(`\n✅ Listo. ${real} tapas reales verificadas · ${designed} diseñadas · ${fixed} corregidas.\n`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
