// Test rápido: sube un video minimalista (3 seg) con privacyStatus="public" y
// devuelve el status real que YouTube le asignó. Si privacyStatus queda
// "public" → auditoría aprobada. Si YouTube lo baja a "unlisted" → aún no.
import "dotenv/config";
import { google } from "googleapis";
import { createReadStream, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { tmpdir } from "node:os";

async function main() {
  const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  const yt = google.youtube({ version: "v3", auth });

  // 1) generar mp4 mínimo con ffmpeg (solo si no existe)
  const mp4 = path.join(tmpdir(), "yt-privacy-test.mp4");
  if (!existsSync(mp4)) {
    console.log("Generando mp4 de test (3 seg)...");
    const ffmpeg = require("ffmpeg-static");
    const r = spawnSync(ffmpeg, [
      "-f", "lavfi", "-i", "color=c=black:s=1280x720:d=3",
      "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
      "-t", "3", "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac",
      "-shortest", "-y", mp4,
    ], { stdio: "inherit" });
    if (r.status !== 0) throw new Error("ffmpeg falló");
  }

  console.log("\nSubiendo con privacyStatus=public...");
  const res = await yt.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: {
        title: "TEST auditoría — borrame",
        description: "Video de prueba para verificar estado de compliance de YouTube API.",
        categoryId: "27",
      },
      status: { privacyStatus: "public", selfDeclaredMadeForKids: false },
    },
    media: { body: createReadStream(mp4) },
  });

  console.log("\n📊 RESULTADO");
  console.log("videoId:", res.data.id);
  console.log("uploadStatus:", res.data.status?.uploadStatus);
  console.log("privacyStatus:", res.data.status?.privacyStatus);
  console.log("madeForKids:", res.data.status?.madeForKids);
  console.log("rejectionReason:", res.data.status?.rejectionReason ?? "(ninguna)");
  console.log("URL:", `https://www.youtube.com/watch?v=${res.data.id}`);

  console.log("\n🔍 DIAGNÓSTICO:");
  if (res.data.status?.privacyStatus === "public") {
    console.log("   ✅ Auditoría APROBADA — subió público directo.");
  } else if (res.data.status?.privacyStatus === "unlisted") {
    console.log("   ⏳ Auditoría NO aprobada aún — YouTube lo forzó a UNLISTED.");
  } else {
    console.log("   ⚠️  Estado inesperado:", res.data.status?.privacyStatus);
  }
}

main().catch((e) => console.error("ERR", e.message || e));
