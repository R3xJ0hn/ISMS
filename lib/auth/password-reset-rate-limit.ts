import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { headers } from "next/headers";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const PASSWORD_RESET_RATE_WINDOW_MS = 15 * 60 * 1000;

export function extractPasswordResetClientIp(headerStore: { get(name: string): string | null }) {
  const forwarded = headerStore.get("x-forwarded-for")?.split(",").map((value) => value.trim()).find((value) => isIP(value) !== 0);
  if (forwarded) return forwarded.toLowerCase();
  const realIp = headerStore.get("x-real-ip")?.trim();
  return realIp && isIP(realIp) !== 0 ? realIp.toLowerCase() : "unknown";
}

export async function recordPasswordResetAttempt(email: string) {
  const ip = extractPasswordResetClientIp(await headers());
  const targets = [
    { scope: "passwordResetIp", value: ip, limit: 20 },
    { scope: "passwordResetEmail", value: email, limit: 5 },
  ];
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_RATE_WINDOW_MS);
  return prisma.$transaction(async (tx) => {
    for (const target of targets) {
      const identifierHash = createHash("sha256").update(`${target.scope}:${target.value}`).digest("hex");
      const rows = await tx.$queryRaw<Array<{ attempts: number }>>(Prisma.sql`
        INSERT INTO "login_rate_limit_buckets" ("scope", "identifier_hash", "attempts", "expires_at", "created_at", "updated_at")
        VALUES (${target.scope}, ${identifierHash}, 1, ${expiresAt}, NOW(), NOW())
        ON CONFLICT ("scope", "identifier_hash") DO UPDATE
        SET "attempts" = CASE WHEN "login_rate_limit_buckets"."expires_at" <= NOW() THEN 1
          ELSE LEAST("login_rate_limit_buckets"."attempts" + 1, ${target.limit + 1}) END,
          "expires_at" = CASE WHEN "login_rate_limit_buckets"."expires_at" <= NOW() THEN ${expiresAt}
          ELSE "login_rate_limit_buckets"."expires_at" END, "updated_at" = NOW()
        RETURNING "attempts"`);
      // Reject the IP first, before storing arbitrary email identifiers from a flood.
      if (!Number.isSafeInteger(rows[0]?.attempts) || rows[0].attempts > target.limit) return false;
    }
    return true;
  });
}
