import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  ismsPrisma?: PrismaClient;
  ismsPrismaClientClass?: typeof PrismaClient;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set.");
  }

  const adapter = new PrismaPg({ connectionString });

  return new PrismaClient({ adapter });
}

const shouldReusePrismaClient =
  globalForPrisma.ismsPrisma &&
  globalForPrisma.ismsPrismaClientClass === PrismaClient;

if (globalForPrisma.ismsPrisma && !shouldReusePrismaClient) {
  void globalForPrisma.ismsPrisma.$disconnect().catch(() => {});
}

export const prisma = shouldReusePrismaClient
  ? globalForPrisma.ismsPrisma!
  : createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.ismsPrisma = prisma;
  globalForPrisma.ismsPrismaClientClass = PrismaClient;
}
