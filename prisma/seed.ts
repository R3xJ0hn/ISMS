import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../lib/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

export type SeedContext = {
  prisma: PrismaClient;
  ids: Map<string, Map<string, bigint>>;
  getId: (group: string, key: string, label?: string) => bigint;
  setId: (group: string, key: string, id: bigint) => void;
  dateOnly: (value: string) => Date;
  dateTime: (value: string) => Date;
};

export type SeedModule = {
  table: string;
  order?: number;
  enabled?: boolean;
  up: (ctx: SeedContext) => Promise<void>;
  down?: (ctx: SeedContext) => Promise<void>;
};

function createSeedContext(): SeedContext {
  const ids = new Map<string, Map<string, bigint>>();

  return {
    prisma,
    ids,

    getId(group: string, key: string, label?: string) {
      const bucket = ids.get(group);
      const id = bucket?.get(key);

      if (!id) {
        throw new Error(`Missing seeded ${label ?? group}: ${key}`);
      }

      return id;
    },

    setId(group: string, key: string, id: bigint) {
      let bucket = ids.get(group);

      if (!bucket) {
        bucket = new Map<string, bigint>();
        ids.set(group, bucket);
      }

      bucket.set(key, id);
    },

    dateOnly(value: string) {
      return new Date(`${value}T00:00:00.000Z`);
    },

    dateTime(value: string) {
      return new Date(value);
    },
  };
}

async function loadSeedModules(): Promise<SeedModule[]> {
  const seedDir = path.resolve(process.cwd(), "prisma/seed-data");
  const entries = await fs.readdir(seedDir, { withFileTypes: true });

  const seedFiles = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter(
      (name) =>
        !name.startsWith("_") &&
        (name.endsWith(".ts") || name.endsWith(".js") || name.endsWith(".mjs"))
    )
    .sort();

  const modules: SeedModule[] = [];

  for (const fileName of seedFiles) {
    const fullPath = path.join(seedDir, fileName);
    const fileUrl = pathToFileURL(fullPath).href;
    const imported = await import(fileUrl);
    const mod: SeedModule = imported.default;

    if (!mod) {
      throw new Error(`Seed file "${fileName}" has no default export.`);
    }

    if (typeof mod.table !== "string" || typeof mod.up !== "function") {
      throw new Error(
        `Seed file "${fileName}" must export a default object with { table, up, down?, order?, enabled? }.`
      );
    }

    if (mod.enabled === false) {
      continue;
    }

    modules.push(mod);
  }

  return modules.sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
}

async function clearSeedData(ctx: SeedContext, modules: SeedModule[]) {
  const reversible = [...modules]
    .filter((mod) => typeof mod.down === "function")
    .sort((a, b) => (b.order ?? 9999) - (a.order ?? 9999));

  for (const mod of reversible) {
    console.info(`Deleting ${mod.table}...`);
    await mod.down!(ctx);
  }
}

async function runSeedData(ctx: SeedContext, modules: SeedModule[]) {
  for (const mod of modules) {
    console.info(`Seeding ${mod.table}...`);
    await mod.up(ctx);
  }
}

/**
 * Execute configured seed modules to reset and populate sample data.
 *
 * Creates a SeedContext, loads seed modules from the project, runs reversible
 * teardown hooks (if present) in reverse order, then runs seed hooks to insert
 * sample records and logs completion.
 */
async function seed() {
  const ctx = createSeedContext();
  const modules = await loadSeedModules();

  await clearSeedData(ctx, modules);
  await runSeedData(ctx, modules);

  console.info("Seeded sample records.");
}

/**
 * Log a seeding error and emit targeted guidance when the database is missing required Prisma tables.
 *
 * If the error is a `Prisma.PrismaClientKnownRequestError` with code `P2021`, logs a concise message
 * explaining that the database schema is out of sync and suggests running `npx prisma db push` or
 * applying the missing migration. For all other errors, logs the error object.
 *
 * @param error - The caught error to inspect and log
 */
function logSeedError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2021") {
      console.error(
        [
          "Seed failed because the database schema is not in sync with prisma/schema.prisma.",
          "Prisma could not find a required table in the current database.",
          'Run "npx prisma db push" or apply the missing migration first, then rerun the seed.',
        ].join("\n")
      );
      return;
    }
  }

  console.error(error);
}

/**
 * Execute the seed process, ensure errors are reported, and always disconnect the Prisma client.
 *
 * If an error occurs while running the seeds, it is reported via `logSeedError` and `process.exitCode`
 * is set to `1`. The Prisma client is disconnected in all cases.
 */
async function main() {
  try {
    await seed();
  } catch (error) {
    logSeedError(error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  logSeedError(error);
  process.exit(1);
});
