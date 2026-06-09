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
  durationSeconds: number | null;
  status: "ready" | "pending" | "processing";
};

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
  publishedAt: Date | null;
  viewsCached: number;
  downloadCount: number;
};
