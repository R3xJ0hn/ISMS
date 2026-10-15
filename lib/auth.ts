import { hashPassword, isBcryptHash, verifyPassword } from "@/lib/auth/credentials";
import { normalizeEmail, parseId } from "@/lib/utils";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { UserRole } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export { hashPassword, passwordHashDefaults } from "@/lib/auth/credentials";

const SESSION_COOKIE_NAME = "isms_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const REMEMBER_ME_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const JWT_SECRET_MIN_BYTES = 32;
const textEncoder = new TextEncoder();

type SessionUser = {
  id: string;
  email: string;
  role: UserRole;
  emailVerified: boolean;
  sessionVersion: number;
};

type SessionTokenPayload = JWTPayload & {
  email: string;
  role: UserRole;
  emailVerified: boolean;
  sessionVersion?: number;
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
      sessionVersion: true,
    },
  });

  const passwordMatches = await verifyPassword(password, user?.passwordHash);

  if (!user || !passwordMatches) {
    return {
      success: false as const,
      message: "Invalid email or password.",
    };
  }

  if (!isBcryptHash(user.passwordHash)) {
    try {
      await prisma.user.updateMany({
        where: {
          id: user.id,
          passwordHash: user.passwordHash,
          sessionVersion: user.sessionVersion,
        },
        data: {
          passwordHash: await hashPassword(password),
        },
      });
    } catch {
      console.error("Failed to rehash user password.");
    }
  }

  return {
    success: true as const,
    user: {
      id: user.id.toString(),
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      sessionVersion: user.sessionVersion,
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
    sessionVersion: user.sessionVersion,
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

export async function clearSession() {
  const cookieStore = await cookies();

  cookieStore.delete(SESSION_COOKIE_NAME);
}

async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify<SessionTokenPayload>(token, getJwtSecret(), {
      algorithms: ["HS256"],
    });

    if (
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.role !== "string" ||
      typeof payload.emailVerified !== "boolean" ||
      (payload.sessionVersion !== undefined &&
        (!Number.isInteger(payload.sessionVersion) || payload.sessionVersion < 0 || payload.sessionVersion > 2147483647))
    ) {
      return null;
    }

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role as UserRole,
      emailVerified: payload.emailVerified,
      sessionVersion: payload.sessionVersion ?? 0,
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

  const session = await verifySessionToken(token);
  if (!session) return null;
  const id = parseId(session.id);
  if (id === null || id <= 0n || id > 9223372036854775807n) return null;

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, role: true, emailVerified: true, sessionVersion: true },
  });
  if (!user || user.sessionVersion !== session.sessionVersion) return null;
  return {
    id: user.id.toString(),
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerified,
    sessionVersion: user.sessionVersion,
  } satisfies SessionUser;
}

export function isAdminRole(role: UserRole) {
  return role === "admin" || role === "superAdmin";
}

export async function requireAuthenticatedSession() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireSession() {
  const session = await requireAuthenticatedSession();
  if (!session.emailVerified) redirect("/verify-email");
  return session;
}

export async function requireAdmin() {
  const session = await requireSession();
  if (!isAdminRole(session.role)) redirect("/portal");
  return session;
}

export async function requireSuperAdmin() {
  const session = await requireSession();
  if (session.role !== "superAdmin") redirect("/portal");
  return session;
}

export async function requireTeacher() {
  const session = await requireSession();
  if (session.role !== "teacher") redirect("/portal");
  return session;
}
