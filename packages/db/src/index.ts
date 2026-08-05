import { PrismaClient } from "../generated/client/index.js";

// Standard Next.js/serverless-safe singleton: avoids exhausting DB
// connections from hot-reload creating a new PrismaClient per request.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export * from "../generated/client/index.js";
