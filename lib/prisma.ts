//Importing Prisma Clent to query the database. 
import { PrismaClient } from "@prisma/client";

//This is a common pattern to ensure that we only have one instance of PrismaClient in development, 
// which prevents issues with hot reloading in Next.js. 
// In production, we can safely create a new instance without worrying about multiple instances.

//globalThis is a JavaScript object that persists across hot reloads. We're storing our Prisma client there so it survives restarts.
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | null };

// If we already have a Prisma client instance, use it. Otherwise, create a new one.
export const prisma = globalForPrisma.prisma ?? new PrismaClient();

// In development, we want to store the Prisma client on the global object to prevent multiple instances during hot reloads.
if (process.env.NODE_ENV !== "production") 
    globalForPrisma.prisma = prisma;