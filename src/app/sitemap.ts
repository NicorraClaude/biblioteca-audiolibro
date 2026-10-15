import type { MetadataRoute } from "next";
import { getPublicBooks } from "@/lib/books";
import { autores, categorias } from "@/lib/seo";

const BASE = "https://biblioteca-audiolibros.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const books = await getPublicBooks();
  const now = new Date();
  const static_: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/privacidad`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/terminos`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
  // Categorías y autores: son las páginas que captan las búsquedas genéricas
  // ("audiolibros de misterio gratis") y las que llevan a Google hasta las fichas.
  const grupos: MetadataRoute.Sitemap = [
    ...categorias(books).map((c) => ({
      url: `${BASE}/categoria/${c.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...autores(books).map((a) => ({
      url: `${BASE}/autor/${a.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
  const fichas: MetadataRoute.Sitemap = books.map((b) => ({
    url: `${BASE}/libro/${b.slug}`,
    lastModified: b.publishedAt ?? now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));
  return [...static_, ...grupos, ...fichas];
}
