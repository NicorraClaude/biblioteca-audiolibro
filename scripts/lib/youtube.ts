// Subida a YouTube (Data API v3) + metadata del video. Sube el mp4 y devuelve
// el videoId, que después se guarda en el libro para embeberlo en la web.
// Requiere OAuth: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN.
import { createReadStream } from "node:fs";
import { google } from "googleapis";

export const YOUTUBE_UPLOAD_SCOPE = "https://www.googleapis.com/auth/youtube.upload";

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
