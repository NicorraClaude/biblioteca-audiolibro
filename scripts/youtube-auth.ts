// Autorización con YouTube (una sola vez). Abre un flujo OAuth: imprime un link,
// vos lo abrís y autorizás en tu cuenta, y el script guarda el "refresh token"
// (permiso de larga duración) en .env. Después, las subidas son automáticas.
//
// Necesita GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en .env (credenciales OAuth
// tipo "Desktop app" de Google Cloud).
//
// Uso:  npx tsx scripts/youtube-auth.ts
import "dotenv/config";
import http from "node:http";
import { appendFile, readFile } from "node:fs/promises";
import path from "node:path";
import { oauthClient, YOUTUBE_UPLOAD_SCOPE } from "./lib/youtube";

const PORT = 4455;
const REDIRECT = `http://localhost:${PORT}`;

async function saveRefreshToken(token: string) {
  const envPath = path.join(process.cwd(), ".env");
  const { writeFile } = await import("node:fs/promises");
  let current = "";
  try {
    current = await readFile(envPath, "utf8");
  } catch { /* no existe aún */ }
  if (/^GOOGLE_REFRESH_TOKEN=/m.test(current)) {
    // reemplazo la línea existente
    const updated = current.replace(/^GOOGLE_REFRESH_TOKEN=.*$/m, `GOOGLE_REFRESH_TOKEN="${token}"`);
    await writeFile(envPath, updated, "utf8");
    console.log("\n✅ REEMPLACÉ GOOGLE_REFRESH_TOKEN en .env con el nuevo. Listo.");
  } else {
    await appendFile(envPath, `\n# YouTube (Fase 4) — permiso de subida\nGOOGLE_REFRESH_TOKEN="${token}"\n`);
    console.log("\n✅ Guardé GOOGLE_REFRESH_TOKEN en .env.");
  }
  console.log("Token (guardalo también, para GitHub Secrets):\n" + token);
}

async function main() {
  const auth = oauthClient(REDIRECT);
  const url = auth.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [YOUTUBE_UPLOAD_SCOPE],
  });

  console.log(
    "\n1) Abrí este link en tu navegador y autorizá con la cuenta de tu canal:\n\n" +
      url +
      "\n\n2) Cuando autorices, esta ventana se completa sola.\n",
  );

  await new Promise<void>((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const u = new URL(req.url ?? "", REDIRECT);
        const code = u.searchParams.get("code");
        if (!code) {
          res.writeHead(400).end("Falta el código.");
          return;
        }
        const { tokens } = await auth.getToken(code);
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(
          "<h2>✅ Listo. Ya podés cerrar esta pestaña y volver a la terminal.</h2>",
        );
        server.close();
        if (tokens.refresh_token) {
          await saveRefreshToken(tokens.refresh_token);
        } else {
          console.log(
            "\n⚠️  Google no devolvió refresh_token (quizás ya autorizaste antes).\n" +
              "   Revocá el acceso en https://myaccount.google.com/permissions y reintentá.",
          );
        }
        resolve();
      } catch (e) {
        reject(e);
      }
    });
    server.listen(PORT);
  });
}

main().catch((e) => {
  console.error("\n✗", e.message);
  process.exit(1);
});
