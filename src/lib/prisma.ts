import { PrismaClient } from "@/generated/prisma/client";

// Standard Next.js pattern: reuse a single PrismaClient across hot reloads
// in dev instead of opening a new connection pool on every module reload.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
