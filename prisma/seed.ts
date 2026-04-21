import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

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

async function seed() {
  const ctx = createSeedContext();
  const modules = await loadSeedModules();

  await clearSeedData(ctx, modules);
  await runSeedData(ctx, modules);

  console.info("Seeded sample records.");
}

async function main() {
  try {
    await seed();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});