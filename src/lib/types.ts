// Tipos del dominio. En la base, los campos de lista/objeto se guardan como
// JSON en texto (SQLite); acá definimos su forma ya parseada para la UI.

export type Language = "es" | "en";
export type ContentLayer = 1 | 2 | 3;

export type AffiliateLink = {
  store: string; // p.ej. "Amazon", "Bajalibros"
  url: string;
};

export type AudioVersion = {
  voiceId: string; // "onyx" | "nova" | "librivox" ...
  voiceName: string; // "Onyx (masculina)" ...
  youtubeVideoId: string | null; // se completa al subir a YouTube (Fase 4)
  youtubePublic?: boolean; // true solo cuando el video ya es público (post-auditoría); hasta entonces se sirve el mp3
  archiveId?: string | null; // identificador de archive.org (grabación LibriVox, reproducible ya)
  audioUrl?: string | null; // mp3 propio (narrado TTS) servido por la app
  // Idioma de ESTA grabación. Sin este campo, el audio de una traducción y el del
  // original eran indistinguibles: alguien leía la traducción al español, apretaba
  // play y escuchaba inglés. Si falta, se asume el idioma original del libro.
  language?: string;
  durationSeconds: number | null;
  status: "ready" | "pending" | "processing";
};

export type SummaryEntry = {
  text: string;
  audioUrl?: string | null; // legado (= voz nova)
  // Audio por voz (♂ onyx / ♀ nova).
  audio?: { onyx?: string; nova?: string };
  // Para resúmenes largos servidos desde YouTube (monetizable).
  youtubeVideoId?: string | null;
  youtubePublic?: boolean;
};
// Por idioma: "sinopsis" (~2-3 min, sin spoilers, genera interés) y
// "resumen" (~20-30 min, recuento completo sin opiniones; solo dominio público).
export type LangSummary = { sinopsis?: SummaryEntry; resumen?: SummaryEntry };
export type SummaryByLang = { es?: LangSummary; en?: LangSummary };

export type LicenseRecord = {
  agreementRef: string;
  territory: string;
  expiresAt: string; // ISO date
  copyTerms: string;
};

// Libro ya "hidratado": los JSON vienen parseados a objetos/arrays.
export type Book = {
  id: string;
  slug: string;
  title: string;
  author: string;
  language: Language;
  contentLayer: ContentLayer;
  contentType: "full_audiobook" | "summary" | "licensed_audiobook";
  status: "published" | "blocked";
  licenseStatus:
    | "public_domain"
    | "cc"
    | "copyrighted_summary_only"
    | "licensed";
  categories: string[];
  description: string;
  coverImageUrl: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  gutenbergId: number | null;
  copyright: boolean;
  librivoxUrl: string | null;
  licenseRecord: LicenseRecord | null;
  ebookPdfUrl: string | null;
  ebookEpubUrl: string | null;
  affiliateLinks: AffiliateLink[];
  audioVersions: AudioVersion[];
  summary: SummaryByLang | null;
  publishedAt: Date | null;
  viewsCached: number;
  downloadCount: number;
};
