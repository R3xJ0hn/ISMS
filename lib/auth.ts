import { scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

import { compare, hash } from "bcryptjs";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";

import type { UserRole } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE_NAME = "isms_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const REMEMBER_ME_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const PASSWORD_HASH_ROUNDS = 12;
const JWT_SECRET_MIN_BYTES = 32;
const DUMMY_PASSWORD_HASH =
  "$2b$12$w0LkwL5Dj1mh2EDkETZjS.uYL2Z1vq5Wm1QX/YTDtzG3wNAvWo6N6";
const STRICT_INTEGER_PATTERN = /^\d+$/;

const LEGACY_SCRYPT_KEY_LENGTH = 64;
const LEGACY_SCRYPT_COST = 16384;
const LEGACY_SCRYPT_BLOCK_SIZE = 8;
const LEGACY_SCRYPT_PARALLELIZATION = 1;
const textEncoder = new TextEncoder();

type SessionUser = {
  id: string;
  email: string;
  role: UserRole;
  emailVerified: boolean;
};

type SessionTokenPayload = JWTPayload & {
  email: string;
  role: UserRole;
  emailVerified: boolean;
};

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not set.");
  }

  const encodedSecret = textEncoder.encode(secret);

  if (encodedSecret.length < JWT_SECRET_MIN_BYTES) {
    throw new Error("JWT_SECRET is too short. It must be at least 32 bytes.");
  }

  return encodedSecret;
}

const JWT_SECRET = getJwtSecret();

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function scrypt(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: {
    N: number;
    r: number;
    p: number;
    maxmem: number;
  }
) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(Buffer.from(derivedKey));
    });
  });
}

function isBcryptHash(value: string) {
  return value.startsWith("$2a$") || value.startsWith("$2b$") || value.startsWith("$2y$");
}

function parseStrictInteger(value: string) {
  if (!STRICT_INTEGER_PATTERN.test(value)) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return null;
  }

  return parsed;
}

async function verifyLegacyScryptHash(password: string, storedHash: string) {
  const [algorithm, costText, blockSizeText, parallelizationText, saltHex, derivedKeyHex] =
    storedHash.split("$");

  if (
    algorithm !== "scrypt" ||
    !costText ||
    !blockSizeText ||
    !parallelizationText ||
    !saltHex ||
    !derivedKeyHex
  ) {
    return false;
  }

  const cost = parseStrictInteger(costText);
  const blockSize = parseStrictInteger(blockSizeText);
  const parallelization = parseStrictInteger(parallelizationText);

  if (
    cost === null ||
    blockSize === null ||
    parallelization === null ||
    !Number.isFinite(cost) ||
    !Number.isFinite(blockSize) ||
    !Number.isFinite(parallelization)
  ) {
    return false;
  }

  const expectedKey = Buffer.from(derivedKeyHex, "hex");
  const actualKey = await scrypt(
    password,
    Buffer.from(saltHex, "hex"),
    expectedKey.length,
    {
      N: cost,
      r: blockSize,
      p: parallelization,
      maxmem: 32 * 1024 * 1024,
    }
  );

  return timingSafeEqual(actualKey, expectedKey);
}

async function verifyPassword(password: string, storedHash: string) {
  if (isBcryptHash(storedHash)) {
    return compare(password, storedHash);
  }

  return verifyLegacyScryptHash(password, storedHash);
}

export async function hashPassword(password: string) {
  return hash(password, PASSWORD_HASH_ROUNDS);
}

export async function authenticateUser(email: string, password: string) {
  const normalizedEmail = normalizeEmail(email);

  const user = await prisma.user.findUnique({
    where: {
      email: normalizedEmail,
    },
    select: {
      id: true,
      email: true,
      role: true,
      emailVerified: true,
      passwordHash: true,
    },
  });

  const passwordMatches = await verifyPassword(
    password,
    user?.passwordHash ?? DUMMY_PASSWORD_HASH
  );

  if (!user || !passwordMatches) {
    return {
      success: false as const,
      message: "Invalid email or password.",
    };
  }

  if (!isBcryptHash(user.passwordHash)) {
    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        passwordHash: await hashPassword(password),
      },
    });
  }

  return {
    success: true as const,
    user: {
      id: user.id.toString(),
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
    } satisfies SessionUser,
  };
}

export async function createSession(
  user: SessionUser,
  options?: {
    remember?: boolean;
  }
) {
  const maxAge = options?.remember
    ? REMEMBER_ME_SESSION_MAX_AGE_SECONDS
    : SESSION_MAX_AGE_SECONDS;

  const token = await new SignJWT({
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerified,
  } satisfies Omit<SessionTokenPayload, keyof JWTPayload | "sub">)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${maxAge}s`)
    .sign(JWT_SECRET);

  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();

  cookieStore.delete(SESSION_COOKIE_NAME);
}

async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify<SessionTokenPayload>(token, JWT_SECRET, {
      algorithms: ["HS256"],
    });

    if (
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.role !== "string" ||
      typeof payload.emailVerified !== "boolean"
    ) {
      return null;
    }

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role as UserRole,
      emailVerified: payload.emailVerified,
    };
  } catch {
    return null;
  }
}

export async function getCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return verifySessionToken(token);
}

export function formatRoleLabel(role: UserRole) {
  return role.replace(/([A-Z])/g, " $1").replace(/^./, (value) => value.toUpperCase());
}

export const passwordHashDefaults = {
  algorithm: "bcrypt",
  rounds: PASSWORD_HASH_ROUNDS,
  legacyScrypt: {
    keyLength: LEGACY_SCRYPT_KEY_LENGTH,
    cost: LEGACY_SCRYPT_COST,
    blockSize: LEGACY_SCRYPT_BLOCK_SIZE,
    parallelization: LEGACY_SCRYPT_PARALLELIZATION,
  },
} as const;
