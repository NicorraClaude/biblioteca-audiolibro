import type { MetadataRoute } from "next";
import { getPublicBooks } from "@/lib/books";

const BASE = "https://biblioteca-audiolibros.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const books = await getPublicBooks();
  const now = new Date();
  const static_: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/privacidad`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/terminos`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
  const fichas: MetadataRoute.Sitemap = books.map((b) => ({
    url: `${BASE}/libro/${b.slug}`,
    lastModified: b.publishedAt ?? now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));
  return [...static_, ...fichas];
}
