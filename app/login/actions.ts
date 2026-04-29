"use server";

import { createHash } from "node:crypto";
import { isIP } from "node:net";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  authenticateUser,
  clearSession,
  createSession,
  normalizeEmail,
} from "@/lib/auth";
import { Prisma } from "@/lib/generated/prisma/client";
import type { UserRole as UserRoleValue } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

const LOGIN_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_RATE_LIMIT_MAX_EMAIL_ATTEMPTS = 5;
const LOGIN_RATE_LIMIT_MAX_IP_ATTEMPTS = 20;
const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password.";

type RateLimitScope = "email" | "ip";

type RateLimitTarget = {
  scope: RateLimitScope;
  identifierHash: string;
  limit: number;
};

export type LoginFormState = {
  status: "idle" | "error";
  message: string;
  email: string;
};

const initialState: LoginFormState = {
  status: "idle",
  message: "",
  email: "",
};

function readFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function getRateLimitKey(scope: "email" | "ip", value: string) {
  return `${scope}:${value}`;
}

function hashRateLimitIdentifier(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function createRateLimitTarget(scope: RateLimitScope, value: string, limit: number): RateLimitTarget {
  return {
    scope,
    identifierHash: hashRateLimitIdentifier(getRateLimitKey(scope, value)),
    limit,
  };
}

function getRateLimitTargetId(target: { scope: string; identifierHash: string }) {
  return `${target.scope}:${target.identifierHash}`;
}

function getRateLimitWindowExpiration() {
  return new Date(Date.now() + LOGIN_RATE_LIMIT_WINDOW_MS);
}

function normalizeIpCandidate(value: string | null) {
  const candidate = value?.trim();

  if (!candidate || isIP(candidate) === 0) {
    return null;
  }

  return candidate;
}

function extractClientIp(headerStore: Awaited<ReturnType<typeof headers>>) {
  const forwardedForEntries =
    headerStore
      .get("x-forwarded-for")
      ?.split(",")
      .map((value) => value.trim())
      .filter(Boolean) ?? [];

  // If you only trust specific proxy hops in production, prefer an env-configured
  // trusted-proxy count here instead of blindly trusting every x-forwarded-for entry.
  const forwardedIp = [...forwardedForEntries]
    .reverse()
    .find((value) => isIP(value) !== 0);

  if (forwardedIp) {
    return forwardedIp;
  }

  return normalizeIpCandidate(headerStore.get("x-real-ip")) ?? "unknown";
}

function normalizeUserAgent(value: string | null) {
  const userAgent = value?.trim();

  if (!userAgent) {
    return null;
  }

  return userAgent.slice(0, 1000);
}

async function getRateLimitTargets(email: string) {
  const headerStore = await headers();
  const ipAddress = extractClientIp(headerStore);

  return [
    createRateLimitTarget("email", email, LOGIN_RATE_LIMIT_MAX_EMAIL_ATTEMPTS),
    createRateLimitTarget("ip", ipAddress, LOGIN_RATE_LIMIT_MAX_IP_ATTEMPTS),
  ];
}

async function checkLoginRateLimit(email: string) {
  const targets = await getRateLimitTargets(email);
  const now = new Date();
  const buckets = await prisma.loginRateLimitBucket.findMany({
    where: {
      OR: targets.map((target) => ({
        scope: target.scope,
        identifierHash: target.identifierHash,
      })),
    },
    select: {
      scope: true,
      identifierHash: true,
      attempts: true,
      expiresAt: true,
    },
  });

  const bucketLookup = new Map(
    buckets.map((bucket) => [getRateLimitTargetId(bucket), bucket])
  );

  return targets.every((target) => {
    const bucket = bucketLookup.get(getRateLimitTargetId(target));

    if (!bucket || bucket.expiresAt <= now) {
      return true;
    }

    return bucket.attempts < target.limit;
  });
}

async function recordFailedLoginAttempt(email: string) {
  const targets = await getRateLimitTargets(email);
  const expiresAt = getRateLimitWindowExpiration();

  await Promise.all(
    targets.map((target) =>
      prisma.$executeRaw(Prisma.sql`
        INSERT INTO "login_rate_limit_buckets" (
          "scope",
          "identifier_hash",
          "attempts",
          "expires_at",
          "created_at",
          "updated_at"
        )
        VALUES (
          ${target.scope},
          ${target.identifierHash},
          1,
          ${expiresAt},
          NOW(),
          NOW()
        )
        ON CONFLICT ("scope", "identifier_hash") DO UPDATE
        SET
          "attempts" = CASE
            WHEN "login_rate_limit_buckets"."expires_at" <= NOW() THEN 1
            ELSE "login_rate_limit_buckets"."attempts" + 1
          END,
          "expires_at" = CASE
            WHEN "login_rate_limit_buckets"."expires_at" <= NOW() THEN ${expiresAt}
            ELSE "login_rate_limit_buckets"."expires_at"
          END,
          "updated_at" = NOW()
      `)
    )
  );
}

async function recordSuccessfulLogin(user: {
  id: string;
  email: string;
  role: UserRoleValue;
}) {
  if (!/^\d+$/.test(user.id)) {
    return;
  }

  const headerStore = await headers();
  const ipAddress = extractClientIp(headerStore);

  await prisma.loginHistory.create({
    data: {
      userId: BigInt(user.id),
      email: user.email,
      role: user.role,
      ipAddress: ipAddress === "unknown" ? null : ipAddress,
      userAgent: normalizeUserAgent(headerStore.get("user-agent")),
    },
  });
}

export async function loginAction(
  _previousState: LoginFormState = initialState,
  formData: FormData
): Promise<LoginFormState> {
  void _previousState;

  const email = readFormValue(formData, "email").trim();
  const password = readFormValue(formData, "password");
  const remember = formData.has("rememberMe");

  if (!email || !password) {
    return {
      status: "error",
      message: "Email and password are required.",
      email,
    };
  }

  const normalizedEmail = normalizeEmail(email);

  if (!(await checkLoginRateLimit(normalizedEmail))) {
    return {
      status: "error",
      message: INVALID_CREDENTIALS_MESSAGE,
      email,
    };
  }

  const result = await authenticateUser(email, password);

  if (!result.success) {
    await recordFailedLoginAttempt(normalizedEmail);

    return {
      status: "error",
      message: INVALID_CREDENTIALS_MESSAGE,
      email,
    };
  }

  await recordSuccessfulLogin(result.user);
  await createSession(result.user, { remember });

  redirect("/portal");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}
