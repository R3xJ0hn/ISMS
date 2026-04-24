"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  authenticateUser,
  clearSession,
  createSession,
  normalizeEmail,
} from "@/lib/auth";

const LOGIN_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_RATE_LIMIT_MAX_EMAIL_ATTEMPTS = 5;
const LOGIN_RATE_LIMIT_MAX_IP_ATTEMPTS = 20;
const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password.";
const loginAttemptStore = new Map<string, number[]>();

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

function getFreshAttempts(key: string, now: number) {
  const attempts =
    loginAttemptStore.get(key)?.filter(
      (timestamp) => now - timestamp < LOGIN_RATE_LIMIT_WINDOW_MS
    ) ?? [];

  if (attempts.length === 0) {
    loginAttemptStore.delete(key);
  } else {
    loginAttemptStore.set(key, attempts);
  }

  return attempts;
}

function extractClientIp(headerStore: Awaited<ReturnType<typeof headers>>) {
  const forwardedFor = headerStore.get("x-forwarded-for");

  if (forwardedFor) {
    const [firstIp] = forwardedFor.split(",");

    if (firstIp) {
      return firstIp.trim();
    }
  }

  return headerStore.get("x-real-ip") ?? "unknown";
}

async function consumeLoginRateLimit(email: string) {
  const headerStore = await headers();
  const ipAddress = extractClientIp(headerStore);
  const now = Date.now();
  const reservations = [
    {
      key: getRateLimitKey("email", email),
      limit: LOGIN_RATE_LIMIT_MAX_EMAIL_ATTEMPTS,
    },
    {
      key: getRateLimitKey("ip", ipAddress),
      limit: LOGIN_RATE_LIMIT_MAX_IP_ATTEMPTS,
    },
  ].map(({ key, limit }) => ({
    key,
    limit,
    attempts: getFreshAttempts(key, now),
  }));

  if (reservations.some(({ attempts, limit }) => attempts.length >= limit)) {
    return false;
  }

  for (const { key, attempts } of reservations) {
    loginAttemptStore.set(key, [...attempts, now]);
  }

  return true;
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

  if (!(await consumeLoginRateLimit(normalizeEmail(email)))) {
    return {
      status: "error",
      message: INVALID_CREDENTIALS_MESSAGE,
      email,
    };
  }

  const result = await authenticateUser(email, password);

  if (!result.success) {
    return {
      status: "error",
      message: INVALID_CREDENTIALS_MESSAGE,
      email,
    };
  }

  await createSession(result.user, { remember });

  redirect("/portal");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}
