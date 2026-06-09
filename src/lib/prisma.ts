// Cliente Prisma único (singleton) para toda la app.
// Prisma 7 usa "driver adapters": para SQLite, el adapter better-sqlite3.
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});

// En desarrollo, Next recarga módulos seguido: reusamos la instancia global
// para no abrir conexiones de más.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
