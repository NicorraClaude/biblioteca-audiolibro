// Proxy de descarga: sirve el e-book DESDE NUESTRO DOMINIO (no desde Gutenberg).
// El usuario descarga en biblioteca-audiolibros... y nunca lo mandamos afuera.
import type { NextRequest } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) {
    return new Response("Solicitud inválida", { status: 400 });
  }
  const name = (req.nextUrl.searchParams.get("n") ?? `libro-${id}`)
    .replace(/[^a-z0-9-]+/gi, "-")
    .slice(0, 80);

  const source = `https://www.gutenberg.org/ebooks/${id}.epub3.images`;
  const upstream = await fetch(source, {
    headers: { "User-Agent": "BibliotecaAbierta/1.0 (descarga dominio público)" },
  });
  if (!upstream.ok || !upstream.body) {
    return new Response("E-book no disponible por ahora.", { status: 502 });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "application/epub+zip",
      "Content-Disposition": `attachment; filename="${name}.epub"`,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
