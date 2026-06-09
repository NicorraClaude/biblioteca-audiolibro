// Cliente Prisma para los scripts de ingesta (corren fuera de Next, con tsx).
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});

export const prisma = new PrismaClient({ adapter });

// Pausa simple (para no martillar las APIs).
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// fetch con reintentos + backoff. Devuelve la Response o null si falla todo.
export async function fetchRetry(
  url: string,
  opts: { tries?: number; timeoutMs?: number } = {},
): Promise<Response | null> {
  const tries = opts.tries ?? 4;
  const timeoutMs = opts.timeoutMs ?? 30000;
  for (let i = 0; i < tries; i++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: { "User-Agent": "BibliotecaAbierta/1.0 (ingesta dominio público)" },
      });
      clearTimeout(t);
      if (res.ok) return res;
      // 429/5xx → esperar y reintentar; otros → cortar.
      if (res.status === 429 || res.status >= 500) {
        await sleep(1500 * (i + 1));
        continue;
      }
      return res; // 4xx no recuperable: que el caller decida
    } catch {
      await sleep(1500 * (i + 1));
    }
  }
  return null;
}
