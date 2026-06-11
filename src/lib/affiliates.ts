// Afiliados — Amazon Associates (y otros). Cuando Nico tenga su cuenta de
// Amazon Associates, pone su TAG acá (o en la env NEXT_PUBLIC_AMAZON_TAG) y
// TODOS los links de Amazon de la web salen con su código → comisión por venta.
//
// El tag se ve así: "minombre-20" (lo da Amazon Associates al crear la cuenta).
export const AMAZON_TAG = process.env.NEXT_PUBLIC_AMAZON_TAG ?? ""; // ← poné tu tag acá

// Le agrega el código de afiliado a un link de tienda (si aplica).
export function withAffiliateTag(store: string, url: string): string {
  if (!AMAZON_TAG) return url;
  if (!/amazon\./i.test(store) && !/amazon\./i.test(url)) return url;
  try {
    const u = new URL(url);
    u.searchParams.set("tag", AMAZON_TAG);
    return u.toString();
  } catch {
    return url;
  }
}

// ¿Tenemos el código cargado? (para mostrar/ocultar avisos de "monetizado").
export const affiliatesActive = AMAZON_TAG.length > 0;
