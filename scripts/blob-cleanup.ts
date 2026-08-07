// Limpia el Blob: identifica archivos de sinopsis que están DUPLICADOS
// (el mismo slug+lang+voice cargado varias veces) y borra los viejos, dejando
// solo la última versión. También lista huérfanos (no referenciados por ningún
// libro del snapshot). MODE=dryrun|delete.
import "dotenv/config";
import { list, del, head } from "@vercel/blob";

const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const MODE = (process.env.MODE ?? "dryrun") as "dryrun" | "delete";

async function listAll(prefix: string) {
  const out: { pathname: string; url: string; size: number; uploadedAt: Date }[] = [];
  let cursor: string | undefined;
  do {
    const r = await list({ prefix, cursor, token: TOKEN, limit: 1000 });
    for (const b of r.blobs) out.push({ pathname: b.pathname, url: b.url, size: b.size, uploadedAt: b.uploadedAt });
    cursor = r.cursor;
  } while (cursor);
  return out;
}

async function main() {
  if (!TOKEN) throw new Error("Falta BLOB_READ_WRITE_TOKEN.");

  const sin = await listAll("sinopsis/");
  console.log(`\nsinopsis/: ${sin.length} archivos, ${(sin.reduce((a,b)=>a+b.size,0)/1024/1024).toFixed(1)} MB`);

  // Agrupar por pathname → los más nuevos primero
  const groups: Record<string, typeof sin> = {};
  for (const f of sin) {
    (groups[f.pathname] = groups[f.pathname] ?? []).push(f);
  }
  const dups = Object.values(groups).filter((g) => g.length > 1);
  console.log(`grupos con duplicados por pathname: ${dups.length}`);

  // Vercel Blob a veces mantiene versiones con distinto random suffix aunque el pathname sea el mismo (allowOverwrite en versiones viejas). Miramos url distintas del mismo pathname.
  let toDelete: { pathname: string; url: string; size: number }[] = [];
  for (const g of dups) {
    g.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
    for (const f of g.slice(1)) toDelete.push({ pathname: f.pathname, url: f.url, size: f.size });
  }

  // Muchas veces "duplicado" en list() es el MISMO archivo listado varias veces por cursor mal. Filtramos por URL única.
  const urlsSeen = new Set<string>();
  toDelete = toDelete.filter((f) => {
    if (urlsSeen.has(f.url)) return false;
    urlsSeen.add(f.url);
    return true;
  });

  const potentialBytes = toDelete.reduce((a, b) => a + b.size, 0);
  console.log(`archivos a borrar: ${toDelete.length} (${(potentialBytes/1024/1024).toFixed(1)} MB)`);
  console.log(`(muestra) primeros 5:\n${toDelete.slice(0,5).map(f=>'  · '+f.pathname).join('\n')}`);

  if (MODE === "delete" && toDelete.length) {
    console.log("\n🗑️  Borrando duplicados...");
    let done = 0;
    // Borrar en batches de 100
    for (let i = 0; i < toDelete.length; i += 100) {
      const batch = toDelete.slice(i, i + 100).map((f) => f.url);
      await del(batch, { token: TOKEN });
      done += batch.length;
      console.log(`  · ${done}/${toDelete.length}`);
    }
    const after = await listAll("sinopsis/");
    console.log(`\n✅ Borrados. Ahora sinopsis/: ${after.length} archivos, ${(after.reduce((a,b)=>a+b.size,0)/1024/1024).toFixed(1)} MB`);
  } else {
    console.log("\n(dryrun — no se borró nada. Correr con MODE=delete para borrar)");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
