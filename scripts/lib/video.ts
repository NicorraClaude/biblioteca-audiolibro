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
  /** Audiolibro completo (horas): codifica más liviano para no comerse la corrida. */
  largo?: boolean;
  /** Duración del audio en segundos. Necesaria para el modo largo. */
  duracionSegundos?: number | null;
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

  // Escala la imagen para que entre en 1280x720 y la centra. El relleno va del mismo
  // marrón oscuro que el fondo del sitio (no negro puro): la imagen OG es más ancha
  // que 16:9, y con negro se veían dos franjas marcadas arriba y abajo.
  const vf =
    "scale=1280:720:force_original_aspect_ratio=decrease," +
    "pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0x181310,setsar=1,format=yuv420p";

  // MODO LARGO (audiolibros completos, de 2 a 15 horas).
  // Codificar hora tras hora la misma imagen fija es absurdo: 2 h 20 de audio
  // tardaban 5 minutos y daban 70 MB. Acá se codifica UN tramo de 60 segundos con
  // la tapa y después se repite ese tramo copiándolo (sin recodificar), con el
  // audio tal cual viene. El mismo libro: 4 segundos y 55 MB.
  if (opts.largo && coverOk && opts.duracionSegundos && opts.duracionSegundos > 120) {
    const loop = path.join(dir, `_loop_${Date.now()}.mp4`);
    await run([
      "-y", "-loop", "1", "-framerate", "1", "-t", "60", "-i", tmpCover,
      "-c:v", "libx264", "-tune", "stillimage", "-preset", "veryfast", "-crf", "28",
      // Un solo cuadro clave cada 60: los demás son idénticos y pesan nada.
      "-g", "60", "-vf", vf, loop,
    ]);
    await run([
      "-y", "-stream_loop", "-1", "-i", loop, "-i", opts.audioPath,
      "-t", String(Math.ceil(opts.duracionSegundos)),
      "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "copy",
      "-movflags", "+faststart", opts.outPath,
    ]);
    await rm(loop, { force: true });
    await rm(tmpCover, { force: true });
    return opts.outPath;
  }

  // Un audiolibro de 5 h con los ajustes de un resumen de 40 min tarda demasiado y
  // pesa de más: 1 cuadro por segundo alcanza para una imagen fija, y el audio
  // hablado no necesita 192 kbps.
  const fps = opts.largo ? "1" : "2";
  const abr = opts.largo ? "64k" : "192k";
  const preset = opts.largo ? "ultrafast" : "veryfast";

  const args = coverOk
    ? [
        "-y",
        "-loop", "1", "-framerate", fps, "-i", tmpCover,
        "-i", opts.audioPath,
        "-c:v", "libx264", "-tune", "stillimage", "-preset", preset,
        "-vf", vf,
        "-c:a", "aac", "-b:a", abr,
        "-shortest", "-movflags", "+faststart",
        opts.outPath,
      ]
    : [
        // Sin tapa: lienzo negro.
        "-y",
        "-f", "lavfi", "-i", "color=c=black:s=1280x720:r=" + fps,
        "-i", opts.audioPath,
        "-c:v", "libx264", "-tune", "stillimage", "-preset", preset,
        "-c:a", "aac", "-b:a", abr,
        "-shortest", "-movflags", "+faststart",
        opts.outPath,
      ];

  await run(args);
  if (coverOk) await rm(tmpCover, { force: true });
  return opts.outPath;
}
