import type { SeedContext, SeedModule } from "./seed";

type SeedCreateResult = { id: bigint } | bigint | void;

type DefineSeedOptions<TRow> = {
  table: string;
  order?: number;
  enabled?: boolean;
  rows: readonly TRow[];
  idGroup?: string;
  getRowKey?: (row: TRow) => string;
  create: (ctx: SeedContext, row: TRow) => Promise<SeedCreateResult>;
  deleteWhere?: (rows: readonly TRow[]) => unknown;
  down?: (ctx: SeedContext, rows: readonly TRow[]) => Promise<void>;
};

function getCreatedId(result: SeedCreateResult): bigint | null {
  if (typeof result === "bigint") {
    return result;
  }

  if (result && typeof result === "object" && "id" in result) {
    return result.id;
  }

  return null;
}

export function defineSeed<TRow>({
  table,
  order,
  enabled,
  rows,
  idGroup,
  getRowKey,
  create,
  deleteWhere,
  down,
}: DefineSeedOptions<TRow>): SeedModule {
  return {
    table,
    order,
    enabled,

    async up(ctx) {
      for (const row of rows) {
        const result = await create(ctx, row);

        if (idGroup && getRowKey) {
          const id = getCreatedId(result);

          if (id !== null) {
            ctx.setId(idGroup, getRowKey(row), id);
          }
        }
      }
    },

    async down(ctx) {
      if (down) {
        await down(ctx, rows);
        return;
      }

      if (!deleteWhere) {
        return;
      }

      const delegate = (
        ctx.prisma as unknown as Record<
          string,
          { deleteMany: (args: { where: unknown }) => Promise<unknown> }
        >
      )[table];

      if (!delegate || typeof delegate.deleteMany !== "function") {
        throw new Error(`Prisma delegate "${table}" does not support deleteMany.`);
      }

      await delegate.deleteMany({
        where: deleteWhere(rows),
      });
    },
  };
}
