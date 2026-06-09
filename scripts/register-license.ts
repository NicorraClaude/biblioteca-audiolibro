// Capa 3 — registrar una licencia editorial (la "puerta" para los acuerdos).
// Al cargar un licenseRecord válido (no vencido), el título deja de estar
// bloqueado y pasa a publicable. Sin licencia válida sigue oculto del público.
//
// Uso:
//   npx tsx scripts/register-license.ts <slug> "<agreementRef>" "<territorio>" <YYYY-MM-DD> "<condiciones>"
// Ej:
//   npx tsx scripts/register-license.ts cien-anos-de-soledad "ACUERDO-2026-001" "Argentina" 2027-12-31 "Hasta 5000 reproducciones/mes"
import { prisma } from "./db";

async function main() {
  const [slug, agreementRef, territory, expiresAt, copyTerms] = process.argv.slice(2);
  if (!slug || !agreementRef || !territory || !expiresAt) {
    throw new Error(
      'Uso: npx tsx scripts/register-license.ts <slug> "<agreementRef>" "<territorio>" <YYYY-MM-DD> "<condiciones>"',
    );
  }
  const book = await prisma.book.findUnique({ where: { slug } });
  if (!book) throw new Error(`No existe el libro "${slug}".`);
  if (book.contentLayer !== 3) {
    throw new Error(`"${slug}" no es Capa 3 (es Capa ${book.contentLayer}). Solo los licenciados llevan licenseRecord.`);
  }

  const expires = new Date(expiresAt);
  if (Number.isNaN(expires.getTime())) throw new Error(`Fecha inválida: ${expiresAt} (usá YYYY-MM-DD).`);
  if (expires.getTime() < Date.now()) throw new Error(`La fecha ${expiresAt} ya venció: el título seguiría bloqueado.`);

  const licenseRecord = {
    agreementRef,
    territory,
    expiresAt: expires.toISOString(),
    copyTerms: copyTerms ?? "",
  };

  await prisma.book.update({
    where: { id: book.id },
    data: { licenseRecord: JSON.stringify(licenseRecord), status: "published" },
  });

  console.log(
    `\n✅ Licencia registrada para "${book.title}".` +
      `\n   Acuerdo: ${agreementRef} · Territorio: ${territory} · Vence: ${expiresAt}` +
      `\n   El título pasó a PUBLICABLE. Actualizá el snapshot y redeployá:` +
      `\n   npx tsx scripts/export-seed.ts && npm run build && vercel --prod --yes\n`,
  );
}

main()
  .catch((e) => {
    console.error("\n✗", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
