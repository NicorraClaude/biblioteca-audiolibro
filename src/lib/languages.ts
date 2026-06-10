// Idiomas: nombre + bandera. Para traducciones a cualquier idioma.
export const LANGS: Record<string, { name: string; flag: string }> = {
  es: { name: "Español", flag: "🇪🇸" },
  en: { name: "English", flag: "🇬🇧" },
  fr: { name: "Français", flag: "🇫🇷" },
  pt: { name: "Português", flag: "🇵🇹" },
  de: { name: "Deutsch", flag: "🇩🇪" },
  it: { name: "Italiano", flag: "🇮🇹" },
  ca: { name: "Català", flag: "🏴" },
  ru: { name: "Русский", flag: "🇷🇺" },
  zh: { name: "中文", flag: "🇨🇳" },
  ja: { name: "日本語", flag: "🇯🇵" },
  ar: { name: "العربية", flag: "🇸🇦" },
};

// Slug seguro para un nombre de idioma libre ("Francés" → "frances").
export function langCode(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
}

export function flagFor(code: string): string {
  return LANGS[code]?.flag ?? "🌐";
}

export function nameFor(code: string, fallback?: string): string {
  return LANGS[code]?.name ?? fallback ?? code;
}
