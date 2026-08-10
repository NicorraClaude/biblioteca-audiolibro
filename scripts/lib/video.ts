// Arma un video (mp4) para YouTube a partir de la tapa del libro + el audio.
// YouTube no acepta audio solo; necesita un video. Usamos la tapa como imagen fija
// centrada sobre un lienzo 1280x720. ffmpeg viene autocontenido (ffmpeg-static).
import { spawn } from "node:child_process";
import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { fetchRetry } from "../db";

function run(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath as string, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}: ${err.slice(-400)}`)),
    );
  });
}

// Descarga la tapa a un archivo temporal (jpg).
async function downloadCover(coverUrl: string, dest: string): Promise<boolean> {
  const res = await fetchRetry(coverUrl, { tries: 3, timeoutMs: 30000 });
  if (!res || !res.ok) return false;
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
  return true;
}

const SITE = process.env.SITE_URL ?? "https://biblioteca-audiolibros.vercel.app";

export async function makeVideo(opts: {
  coverUrl: string | null;
  audioPath: string;
  outPath: string;
  /** Slug del libro: si no hay archivo de tapa, se usa la imagen diseñada del sitio. */
  slug?: string;
}): Promise<string> {
  const dir = path.dirname(opts.outPath);
  await mkdir(dir, { recursive: true });
  const tmpCover = path.join(dir, `_cover_${Date.now()}.jpg`);

  let coverOk = false;
  if (opts.coverUrl) coverOk = await downloadCover(opts.coverUrl, tmpCover);
  // Muchos libros (todos los modernos) no tienen archivo de tapa: su portada se
  // dibuja en la web, no existe como imagen. Sin esto el video salía 40 minutos de
  // pantalla negra. La imagen OG del sitio ya está diseñada y trae título, autor y
  // marca, así que sirve de fondo sin inventar nada nuevo.
  if (!coverOk && opts.slug) {
    coverOk = await downloadCover(`${SITE}/libro/${opts.slug}/opengraph-image`, tmpCover);
  }

  // Filtro: escalar la tapa para que entre en 1280x720 y centrarla con relleno negro.
  const vf =
    "scale=1280:720:force_original_aspect_ratio=decrease," +
    "pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,format=yuv420p";

  const args = coverOk
    ? [
        "-y",
        "-loop", "1", "-framerate", "2", "-i", tmpCover,
        "-i", opts.audioPath,
        "-c:v", "libx264", "-tune", "stillimage", "-preset", "veryfast",
        "-vf", vf,
        "-c:a", "aac", "-b:a", "192k",
        "-shortest", "-movflags", "+faststart",
        opts.outPath,
      ]
    : [
        // Sin tapa: lienzo negro.
        "-y",
        "-f", "lavfi", "-i", "color=c=black:s=1280x720:r=2",
        "-i", opts.audioPath,
        "-c:v", "libx264", "-tune", "stillimage", "-preset", "veryfast",
        "-c:a", "aac", "-b:a", "192k",
        "-shortest", "-movflags", "+faststart",
        opts.outPath,
      ];

  await run(args);
  if (coverOk) await rm(tmpCover, { force: true });
  return opts.outPath;
}
