import { getPublicBooks } from "@/lib/books";
import { paraTarjeta } from "@/lib/presentation";

// El catálogo completo, liviano, para el buscador de la portada. Se genera una
// sola vez en el build (el sitio es 100% estático) y el navegador lo pide recién
// cuando la persona llega al catálogo. Antes viajaba adentro de la portada, que
// pesaba 5,3 MB: cada robot que la pedía (Facebook, unas 300 veces por día) le
// costaba esos megas a la cuenta de Vercel, y así se pasó el límite del plan.
export const dynamic = "force-static";

export async function GET() {
  const books = await getPublicBooks();
  return Response.json(books.map(paraTarjeta));
}
