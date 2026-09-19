// Subida a YouTube (Data API v3) + metadata del video. Sube el mp4 y devuelve
// el videoId, que después se guarda en el libro para embeberlo en la web.
// Requiere OAuth: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN.
import { createReadStream } from "node:fs";
import { google } from "googleapis";

export const YOUTUBE_UPLOAD_SCOPE = "https://www.googleapis.com/auth/youtube.upload";
// Permiso completo del canal (editar, pasar a privado, listas, estadísticas).
// Autorizado por Nico el 19/09/2026. Borrar videos NO se hace por código: se pasan a
// privado y el borrado definitivo lo decide y lo hace él desde YouTube Studio.
export const YOUTUBE_FULL_SCOPE = "https://www.googleapis.com/auth/youtube";

export function oauthClient(redirectUri?: string) {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error(
      "Faltan GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET. Configurá las credenciales de OAuth de Google.",
    );
  }
  return new google.auth.OAuth2(id, secret, redirectUri);
}

type VideoMeta = {
  title: string;
  author: string;
  language: "es" | "en";
  voiceName: string;
  categories: string[];
  sourceName: string | null;
  siteUrl: string;
};

export function buildVideoMetadata(m: VideoMeta) {
  const isEs = m.language === "es";
  const title = `${m.title} — ${m.author} | Audiolibro completo (${m.voiceName})`.slice(0, 100);
  const description = isEs
    ? [
        `${m.title}, de ${m.author}.`,
        ``,
        `Audiolibro completo, narrado con voz ${m.voiceName}. Obra de dominio público${m.sourceName ? ` (${m.sourceName})` : ""}.`,
        ``,
        `📖 Escuchá y descargá gratis el libro completo en: ${m.siteUrl}`,
        ``,
        `Este audiolibro es de dominio público y se puede compartir libremente.`,
      ].join("\n")
    : [
        `${m.title}, by ${m.author}.`,
        ``,
        `Full audiobook, narrated with the ${m.voiceName} voice. Public-domain work${m.sourceName ? ` (${m.sourceName})` : ""}.`,
        ``,
        `📖 Listen and download the full book for free at: ${m.siteUrl}`,
      ].join("\n");

  const tags = [
    "audiolibro",
    "audiobook",
    m.author,
    "dominio público",
    "public domain",
    ...m.categories,
  ].slice(0, 15);

  return { title, description, tags };
}

export async function uploadVideo(opts: {
  videoPath: string;
  title: string;
  description: string;
  tags: string[];
  language: "es" | "en";
  privacyStatus: "private" | "unlisted" | "public";
}): Promise<string> {
  const auth = oauthClient();
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  if (!process.env.GOOGLE_REFRESH_TOKEN) {
    throw new Error(
      "Falta GOOGLE_REFRESH_TOKEN. Corré primero: npx tsx scripts/youtube-auth.ts",
    );
  }
  const youtube = google.youtube({ version: "v3", auth });

  const res = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: {
        title: opts.title,
        description: opts.description,
        tags: opts.tags,
        categoryId: "27", // Education
        defaultLanguage: opts.language,
        defaultAudioLanguage: opts.language,
      },
      status: {
        privacyStatus: opts.privacyStatus,
        selfDeclaredMadeForKids: false,
      },
    },
    media: { body: createReadStream(opts.videoPath) },
  });

  const videoId = res.data.id;
  if (!videoId) throw new Error("YouTube no devolvió un videoId.");
  return videoId;
}

// ---------- Gestión del canal (requiere el permiso completo `youtube`) ----------
export const UPLOADS_PLAYLIST = "UUJBAm41Rsc3doYqCcujenTA"; // "subidas" del canal BibliotecaAbierta

export function youtubeClient() {
  const auth = oauthClient();
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return google.youtube({ version: "v3", auth });
}

export const normalizarTitulo = (t: string) =>
  t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

// Títulos PÚBLICOS del canal → videoId. Segunda barrera contra duplicados: aunque se
// pierda el registro y el catálogo, no se sube algo que el canal ya muestra.
export async function titulosPublicados(): Promise<Map<string, string>> {
  const yt = youtubeClient();
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const r = await yt.playlistItems.list({ part: ["contentDetails"], playlistId: UPLOADS_PLAYLIST, maxResults: 50, pageToken });
    for (const it of r.data.items ?? []) ids.push(it.contentDetails!.videoId!);
    pageToken = r.data.nextPageToken ?? undefined;
  } while (pageToken);
  const out = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 50) {
    const r = await yt.videos.list({ part: ["snippet", "status"], id: ids.slice(i, i + 50) });
    for (const v of r.data.items ?? []) {
      if (v.status?.privacyStatus === "public" && v.snippet?.title) out.set(normalizarTitulo(v.snippet.title), v.id!);
    }
  }
  return out;
}

// Devuelve el id de la lista con ese nombre; la crea (pública) si no existe.
const cachePlaylists = new Map<string, string>();
export async function asegurarPlaylist(titulo: string, descripcion: string): Promise<string> {
  if (cachePlaylists.has(titulo)) return cachePlaylists.get(titulo)!;
  const yt = youtubeClient();
  let pageToken: string | undefined;
  do {
    const r = await yt.playlists.list({ part: ["snippet"], mine: true, maxResults: 50, pageToken });
    for (const p of r.data.items ?? []) if (p.snippet?.title === titulo) { cachePlaylists.set(titulo, p.id!); return p.id!; }
    pageToken = r.data.nextPageToken ?? undefined;
  } while (pageToken);
  const r = await yt.playlists.insert({
    part: ["snippet", "status"],
    requestBody: { snippet: { title: titulo, description: descripcion, defaultLanguage: "es" }, status: { privacyStatus: "public" } },
  });
  cachePlaylists.set(titulo, r.data.id!);
  return r.data.id!;
}

// Con reintentos: una lista recién creada tarda unos segundos en "existir" para la API.
export async function agregarAPlaylist(playlistId: string, videoId: string): Promise<void> {
  for (let i = 0; ; i++) {
    try {
      await youtubeClient().playlistItems.insert({
        part: ["snippet"],
        requestBody: { snippet: { playlistId, resourceId: { kind: "youtube#video", videoId } } },
      });
      return;
    } catch (e) {
      if (i >= 3 || /quota/i.test((e as Error).message)) throw e;
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

// Lista a la que va cada libro según su tipo.
export function playlistPara(contentLayer: number): { titulo: string; descripcion: string } {
  return contentLayer === 2
    ? { titulo: "Resúmenes de libros de negocios y desarrollo personal",
        descripcion: "Las ideas centrales de los libros más recomendados de negocios, finanzas y desarrollo personal, en español. Más en https://biblioteca-audiolibros.vercel.app" }
    : { titulo: "Clásicos de la literatura: resúmenes en español",
        descripcion: "Resúmenes narrados de los grandes clásicos. El libro completo, gratis en audio y texto: https://biblioteca-audiolibros.vercel.app" };
}
