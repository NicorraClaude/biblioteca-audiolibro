// Consulta el estado real del canal en YouTube: (1) lista todos los videos y su
// privacidad — si alguno pasó a "public" automático es señal de auditoría OK;
// (2) intenta obtener el estado de la cuota diaria (default vs extendida).
import "dotenv/config";
import { google } from "googleapis";

async function main() {
  const oauth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
  oauth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  const yt = google.youtube({ version: "v3", auth: oauth });

  // 1) Canal del owner
  const chan = await yt.channels.list({ part: ["snippet", "contentDetails", "statistics", "status"], mine: true });
  const c = chan.data.items?.[0];
  if (!c) { console.log("❌ no encontré el canal"); return; }
  console.log(`\n📺 Canal: ${c.snippet?.title}`);
  console.log(`   subs: ${c.statistics?.subscriberCount} · videos: ${c.statistics?.videoCount} · views: ${c.statistics?.viewCount}`);
  console.log(`   longUploadsStatus: ${c.status?.longUploadsStatus} · madeForKids: ${c.status?.madeForKids}`);

  // 2) Lista todos los videos del canal (via uploads playlist)
  const uploadsPl = c.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPl) { console.log("no hay playlist uploads"); return; }

  const videoIds: string[] = [];
  let pageToken: string | undefined;
  do {
    const pl = await yt.playlistItems.list({ part: ["contentDetails"], playlistId: uploadsPl, maxResults: 50, pageToken });
    for (const it of pl.data.items ?? []) if (it.contentDetails?.videoId) videoIds.push(it.contentDetails.videoId);
    pageToken = pl.data.nextPageToken ?? undefined;
  } while (pageToken);

  console.log(`\n🎬 Videos en el canal: ${videoIds.length}`);
  if (!videoIds.length) return;

  // 3) Detalle de cada video (privacyStatus, embeddable, license)
  const details = await yt.videos.list({ part: ["snippet", "status"], id: videoIds });
  const counts: Record<string, number> = {};
  console.log("\n(últimos primero)");
  for (const v of (details.data.items ?? []).slice(0, 30)) {
    const ps = v.status?.privacyStatus ?? "?";
    counts[ps] = (counts[ps] ?? 0) + 1;
    console.log(`  · ${ps.padEnd(9)} · ${v.id} · ${(v.snippet?.title ?? "").slice(0, 60)} · ${v.snippet?.publishedAt?.slice(0, 10)}`);
  }
  console.log(`\n📊 privacidades: ${JSON.stringify(counts)}`);

  // 4) Prueba de cuota
  console.log("\n(la cuota real solo la ves en Google Cloud Console → APIs & Services → YouTube Data API v3 → Quotas)");
  console.log("Default: 10,000 units/día · Aprobada: 1,000,000+");
}

main().catch((e) => { console.error("ERR", e.message); });
