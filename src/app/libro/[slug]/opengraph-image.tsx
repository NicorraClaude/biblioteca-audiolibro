import { ImageResponse } from "next/og";
import { coverColors } from "@/lib/presentation";
import { notFound } from "next/navigation";
// Lee del snapshot JSON directo, sin Prisma: la OG imagen se genera en runtime
// y en Vercel la Function no tiene dev.db → así funciona en producción.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const seed: Array<{ slug: string; title: string; author: string; coverImageUrl: string | null; contentLayer: number }> = require("../../../../prisma/seed-data.json");

export const alt = "Biblioteca Abierta";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Imagen que se muestra al compartir un libro en WhatsApp, Twitter, etc.
// Compuesta: tapa del libro a la izquierda + info y branding a la derecha.
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const book = seed.find((b) => b.slug === slug);
  // Antes solo la generaba para Capa 1. Ahora también para los modernos (Capa 2):
  // es la imagen que se ve al compartir en WhatsApp Y el fondo de los videos de
  // YouTube (esos libros no tienen archivo de tapa, así que sin esto el video sale
  // 40 minutos de pantalla negra).
  if (!book) notFound();
  const esResumen = book.contentLayer !== 1;

  const [from, to] = coverColors(book.slug);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#181310",
          color: "#f1e4d0",
          fontFamily: "sans-serif",
        }}
      >
        {/* tapa a la izquierda */}
        <div
          style={{
            width: 420,
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: `linear-gradient(150deg, ${from}, ${to})`,
          }}
        >
          {book.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={book.coverImageUrl} alt="" style={{ maxWidth: "80%", maxHeight: "80%", objectFit: "contain", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }} />
          ) : (
            <div style={{ fontSize: 260, fontWeight: 800, color: "rgba(255,255,255,0.2)" }}>
              {book.title.replace(/[^\p{L}\p{N}]/gu, "").charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* info a la derecha */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "70px 60px", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 22, letterSpacing: 6, textTransform: "uppercase", color: "#c89b5c" }}>Biblioteca Abierta</div>
            <div style={{ fontSize: 62, fontWeight: 700, lineHeight: 1.05, color: "#faf6ec" }}>{book.title.slice(0, 90)}</div>
            <div style={{ fontSize: 30, color: "#d8c4a0", marginTop: 6 }}>{book.author}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ background: "#ec5a36", color: "#fff", padding: "10px 22px", borderRadius: 999, fontSize: 22, fontWeight: 700 }}>
                {esResumen ? "Resumen gratis" : "Escuchar gratis"}
              </div>
              {/* No prometer lo que no hay: los modernos son análisis original en
                  español, no el libro completo bilingüe. */}
              <div style={{ color: "#a89b7a", fontSize: 22 }}>
                {esResumen ? "· Resumen en audio · ~40 min" : "· Audio + texto · ES / EN"}
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
