import { scryptSync, timingSafeEqual } from "node:crypto";

import { compare, hash } from "bcryptjs";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";

import type { UserRole } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE_NAME = "isms_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const REMEMBER_ME_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const PASSWORD_HASH_ROUNDS = 12;

const LEGACY_SCRYPT_KEY_LENGTH = 64;
const LEGACY_SCRYPT_COST = 16384;
const LEGACY_SCRYPT_BLOCK_SIZE = 8;
const LEGACY_SCRYPT_PARALLELIZATION = 1;

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

/**
 * Retrieve the JWT signing secret from the environment and return it as UTF-8 bytes.
 *
 * @returns The `JWT_SECRET` value encoded as a `Uint8Array` (UTF-8).
 * @throws If `process.env.JWT_SECRET` is not set.
 */
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not set.");
  }

  return new TextEncoder().encode(secret);
}

/**
 * Normalize an email address by trimming surrounding whitespace and converting it to lowercase.
 *
 * @returns The normalized email string with surrounding whitespace removed and all characters lowercased
 */
function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

/**
 * Checks whether a string is formatted with a bcrypt hash prefix.
 *
 * @param value - The hash string to inspect
 * @returns `true` if the string begins with a bcrypt prefix (`$2a$`, `$2b$`, or `$2y$`), `false` otherwise.
 */
function isBcryptHash(value: string) {
  return value.startsWith("$2a$") || value.startsWith("$2b$") || value.startsWith("$2y$");
}

/**
 * Verifies a password against a legacy scrypt-formatted stored hash.
 *
 * The expected `storedHash` format is:
 * `scrypt$<N>$<r>$<p>$<saltHex>$<derivedKeyHex>`, where `N`, `r`, and `p`
 * are numeric scrypt parameters and `saltHex` / `derivedKeyHex` are hex-encoded.
 *
 * @param password - The plaintext password to verify
 * @param storedHash - The legacy scrypt hash string in the format described above
 * @returns `true` if the provided password matches the stored legacy scrypt hash, `false` otherwise.
 */
function verifyLegacyScryptHash(password: string, storedHash: string) {
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

  const cost = Number.parseInt(costText, 10);
  const blockSize = Number.parseInt(blockSizeText, 10);
  const parallelization = Number.parseInt(parallelizationText, 10);

  if (
    !Number.isFinite(cost) ||
    !Number.isFinite(blockSize) ||
    !Number.isFinite(parallelization)
  ) {
    return false;
  }

  const expectedKey = Buffer.from(derivedKeyHex, "hex");
  const actualKey = scryptSync(password, Buffer.from(saltHex, "hex"), expectedKey.length, {
    N: cost,
    r: blockSize,
    p: parallelization,
    maxmem: 32 * 1024 * 1024,
  });

  return timingSafeEqual(actualKey, expectedKey);
}

/**
 * Verify whether a plaintext password matches a stored password hash (bcrypt or legacy scrypt).
 *
 * @param password - The plaintext password to verify.
 * @param storedHash - The stored password hash, either a bcrypt hash or a legacy scrypt-formatted string.
 * @returns `true` if the password matches the stored hash, `false` otherwise.
 */
async function verifyPassword(password: string, storedHash: string) {
  if (isBcryptHash(storedHash)) {
    return compare(password, storedHash);
  }

  return verifyLegacyScryptHash(password, storedHash);
}

/**
 * Create a bcrypt hash of the given password.
 *
 * @returns A bcrypt-formatted password hash.
 */
export async function hashPassword(password: string) {
  return hash(password, PASSWORD_HASH_ROUNDS);
}

/**
 * Authenticate a user by email and password and upgrade legacy password hashes to bcrypt on successful login.
 *
 * On success returns the authenticated user's session-safe details; on failure returns a generic authentication error message.
 *
 * This function normalizes the provided email, verifies the password against the stored hash (supporting both bcrypt and legacy scrypt), and if authentication succeeds and the stored hash is not bcrypt it re-hashes the password with the current bcrypt parameters and updates the database.
 *
 * @param email - The user's email address (raw input; will be normalized)
 * @param password - The plaintext password to verify
 * @returns An object with either `{ success: false; message: string }` for failed authentication or `{ success: true; user: { id: string; email: string; role: UserRole; emailVerified: boolean } }` for successful authentication
 */
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

  if (!user) {
    return {
      success: false as const,
      message: "Invalid email or password.",
    };
  }

  const passwordMatches = await verifyPassword(password, user.passwordHash);

  if (!passwordMatches) {
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

/**
 * Create an HTTP-only session cookie containing an HS256-signed JWT for the given user.
 *
 * The token payload includes the user's email, role, and emailVerified flag, `sub` is set to the user's id,
 * and the token's lifetime is determined by `options.remember` (longer when true). The cookie's max-age
 * matches the token expiration and is scoped to "/" with `SameSite=Lax` and `httpOnly`.
 *
 * @param user - Authenticated user information to embed in the session token
 * @param options - Optional session creation flags
 * @param options.remember - When true, use the longer "remember me" session lifetime
 */
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
    .sign(getJwtSecret());

  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
}

/**
 * Deletes the current session cookie from the Next.js cookie store.
 *
 * This removes the cookie named by SESSION_COOKIE_NAME so the client no longer has an active session.
 */
export async function clearSession() {
  const cookieStore = await cookies();

  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Validate a session JWT and return the corresponding session user.
 *
 * Only tokens signed with HS256 that include a string `sub`, string `email`, string `role`,
 * and boolean `emailVerified` are accepted.
 *
 * @param token - The session JWT to verify
 * @returns A SessionUser constructed from the token payload if valid, `null` otherwise
 */
async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify<SessionTokenPayload>(token, getJwtSecret(), {
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

/**
 * Reads the session cookie and returns the authenticated session, or null if none is present or invalid.
 *
 * @returns `SessionUser` when the session token is valid, `null` if there is no session cookie or token verification fails.
 */
export async function getCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return verifySessionToken(token);
}

/**
 * Format a UserRole into a human-readable label.
 *
 * Inserts spaces before capital letters and capitalizes the first character of the result.
 *
 * @param role - Role identifier (e.g., "siteAdmin" or "SuperUser")
 * @returns A human-readable label with spaces between words and an initial capital letter (e.g., "Site Admin")
 */
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
