// Pasa a PRIVADO todo video PÚBLICO del canal que la web no usa (duplicados, versiones
// en inglés, pruebas). No borra nada: privado es reversible, y el borrado definitivo
// lo decide Nico desde YouTube Studio.
// "En uso" = cualquier youtubeVideoId del catálogo o del registro de R2.
//
// Uso:  npx tsx scripts/limpiar-canal-youtube.ts            (solo muestra)
//       APLICAR=1 npx tsx scripts/limpiar-canal-youtube.ts  (aplica)
import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { google } from "googleapis";
import { oauthClient } from "./lib/youtube";
import { r2GetText } from "../src/lib/r2";

const UPLOADS = "UUJBAm41Rsc3doYqCcujenTA"; // lista "subidas" del canal BibliotecaAbierta
const APLICAR = process.env.APLICAR === "1";

async function main() {
  const auth = oauthClient();
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  const yt = google.youtube({ version: "v3", auth });

  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const r = await yt.playlistItems.list({ part: ["contentDetails"], playlistId: UPLOADS, maxResults: 50, pageToken });
    for (const it of r.data.items ?? []) ids.push(it.contentDetails!.videoId!);
    pageToken = r.data.nextPageToken ?? undefined;
  } while (pageToken);

  const seed = readFileSync("prisma/seed-data.json", "utf8");
  const enUso = new Set([...seed.matchAll(/youtubeVideoId\\?"\s*:\s*\\?"([\w-]{11})/g)].map((m) => m[1]));
  const reg = JSON.parse((await r2GetText("youtube/subidos.json")) ?? "{}") as Record<string, string>;
  for (const [k, v] of Object.entries(reg)) if (k.endsWith(":es")) enUso.add(v);

  const sobran: { id: string; title: string; status: Record<string, unknown> }[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const r = await yt.videos.list({ part: ["snippet", "status"], id: ids.slice(i, i + 50) });
    for (const v of r.data.items ?? []) {
      if (enUso.has(v.id!) || v.status?.privacyStatus !== "public") continue;
      sobran.push({ id: v.id!, title: v.snippet?.title ?? "", status: v.status as Record<string, unknown> });
    }
  }
  console.log(`Canal: ${ids.length} videos · la web usa ${enUso.size} · públicos que sobran: ${sobran.length}`);
  if (!APLICAR) { for (const s of sobran) console.log(`  · ${s.id}  ${s.title.slice(0, 70)}`); return; }

  const hechos: string[] = [];
  for (const s of sobran) {
    try {
      // Se reenvía el status completo: los campos que no se mandan vuelven a su default.
      const st = s.status as Record<string, unknown>;
      await yt.videos.update({
        part: ["status"],
        requestBody: { id: s.id, status: {
          privacyStatus: "private",
          embeddable: st.embeddable as boolean,
          license: st.license as string,
          publicStatsViewable: st.publicStatsViewable as boolean,
          selfDeclaredMadeForKids: (st.madeForKids as boolean) ?? false,
        } },
      });
      hechos.push(s.id);
      console.log(`  ✓ privado: ${s.id}  ${s.title.slice(0, 60)}`);
    } catch (e) {
      console.error(`  ✗ ${s.id}: ${(e as Error).message}`);
      if (/quota/i.test((e as Error).message)) break;
    }
  }
  const archivo = `limpieza-canal-${new Date().toISOString().slice(0, 10)}.json`;
  writeFileSync(`/tmp/${archivo}`, JSON.stringify(hechos));
  console.log(`\n✅ ${hechos.length}/${sobran.length} pasados a privado. IDs en /tmp/${archivo}`);
}
main().catch((e) => { console.error("✗", e.message); process.exit(1); });
