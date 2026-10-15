import { createHmac, randomUUID } from "node:crypto";
import { normalizeEmail, parseRecordId } from "@/lib/utils";
import { validateEmail } from "@/lib/validation";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";

type TokenPolicy = {
  issuer: string;
  audience: string;
  scope: string;
  secretVariable: string;
  secretError: string;
};

function tokenSecret(policy: Pick<TokenPolicy, "secretVariable" | "secretError">) {
  const value = process.env[policy.secretVariable] ?? process.env.JWT_SECRET;
  const encoded = new TextEncoder().encode(value);
  if (!value || encoded.length < 32) throw new Error(policy.secretError);
  return encoded;
}

async function createScopedToken(policy: TokenPolicy, subject: string, claims: JWTPayload, ttlSeconds: number) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = new Date((issuedAt + ttlSeconds) * 1000);
  const jti = randomUUID();
  const token = await new SignJWT({ ...claims, scope: policy.scope })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(subject).setJti(jti).setIssuer(policy.issuer).setAudience(policy.audience)
    .setIssuedAt(issuedAt).setExpirationTime(issuedAt + ttlSeconds).sign(tokenSecret(policy));
  return { token, jti, expiresAt };
}

/** Signature and common claims only; each flow must validate its own identity and account claims. */
async function verifyScopedToken(token: string, policy: TokenPolicy, lifetimes: readonly number[]): Promise<(JWTPayload & { sub: string; jti: string; expiresAt: Date }) | null> {
  if (!token || token.length > 4096) return null;
  try {
    const { payload } = await jwtVerify(token, tokenSecret(policy), {
      algorithms: ["HS256"], issuer: policy.issuer, audience: policy.audience,
      requiredClaims: ["sub", "jti", "iat", "exp"],
    });
    if (payload.scope !== policy.scope || typeof payload.sub !== "string" ||
      typeof payload.jti !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(payload.jti) ||
      typeof payload.iat !== "number" || !Number.isSafeInteger(payload.iat) ||
      typeof payload.exp !== "number" || !Number.isSafeInteger(payload.exp) ||
      !lifetimes.includes(payload.exp - payload.iat) || payload.iat > Math.floor(Date.now() / 1000) + 5) return null;
    return { ...payload, sub: payload.sub, jti: payload.jti, expiresAt: new Date(payload.exp * 1000) };
  } catch { return null; }
}

export function validateAuthUrl(value: string, errorMessage: string) {
  const url = new URL(value.trim());
  if (url.username || url.password ||
    (url.protocol !== "https:" && !(process.env.NODE_ENV === "development" && url.protocol === "http:"))) {
    throw new Error(errorMessage);
  }
  return url;
}

function createAuthUrl(pathname: string, token: string, errorMessage: string) {
  const configured = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const url = new URL(pathname, validateAuthUrl(configured, errorMessage));
  url.searchParams.set("token", token);
  return url.toString();
}

const EMAIL_VERIFICATION_TTL_SECONDS = 60 * 60;
const verificationPolicy = {
  issuer: "isms", audience: "email-verification", scope: "email-verification",
  secretVariable: "EMAIL_VERIFICATION_SECRET",
  secretError: "Email verification requires a secret of at least 32 bytes.",
};

export type EmailVerificationClaims = {
  userId: string;
  email: string;
  jti: string;
  expiresAt: Date;
};

export function parseVerificationUserId(value: string): bigint | null {
  return parseRecordId(value, { canonical: true });
}

export function validVerificationEmail(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 320 &&
    value === value.trim() && !/[\u0000-\u001f\u007f]/.test(value) && validateEmail(value);
}

export async function createEmailVerificationToken(userId: string, email: string) {
  if (parseVerificationUserId(userId) === null || !validVerificationEmail(email)) {
    throw new Error("Invalid email verification account.");
  }
  return createScopedToken(verificationPolicy, userId, { purpose: "emailVerification", email }, EMAIL_VERIFICATION_TTL_SECONDS);
}

export async function verifyEmailVerificationToken(token: string): Promise<EmailVerificationClaims | null> {
  const payload = await verifyScopedToken(token, verificationPolicy, [EMAIL_VERIFICATION_TTL_SECONDS]);
  if (!payload || payload.purpose !== "emailVerification" || parseVerificationUserId(payload.sub) === null ||
    !validVerificationEmail(payload.email)) return null;
  return { userId: payload.sub, email: payload.email, jti: payload.jti, expiresAt: payload.expiresAt };
}

export function createEmailVerificationUrl(token: string) {
  return createAuthUrl("/verify-email", token, "Email verification URLs must use HTTPS outside development.");
}

export const PASSWORD_RESET_TTL_SECONDS = 1800;
const passwordResetPolicy = {
  issuer: "isms-password-reset", audience: "password-reset", scope: "password-reset",
  secretVariable: "PASSWORD_RESET_SECRET",
  secretError: "Password reset requires a secret of at least 32 bytes.",
};
export type PasswordResetClaims = {
  userId: string; email: string; jti: string; sessionVersion: number; credentialFingerprint: string; expiresAt: Date;
};
export type PasswordResetAccount = { id: string; email: string; passwordHash: string; sessionVersion: number };

function parsePasswordResetUserId(value: string): bigint | null {
  return parseRecordId(value, { canonical: true, maxDigits: 19 });
}
export function validPasswordResetEmail(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 320 && value === normalizeEmail(value) &&
    !/[\u0000-\u001f\u007f-\u009f\p{Cf}]/u.test(value) && validateEmail(value);
}
function validSessionVersion(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 2147483647;
}
export function passwordResetCredentialFingerprint(passwordHash: string) {
  return createHmac("sha256", tokenSecret(passwordResetPolicy)).update("password-reset-credentials\0").update(passwordHash).digest("hex");
}

export async function createPasswordResetToken(user: PasswordResetAccount) {
  if (parsePasswordResetUserId(user.id) === null || !validPasswordResetEmail(user.email) || !validSessionVersion(user.sessionVersion) ||
    typeof user.passwordHash !== "string" || !user.passwordHash) throw new Error("Invalid password reset account.");
  return createScopedToken(passwordResetPolicy, user.id, {
    email: user.email, sessionVersion: user.sessionVersion,
    credentialFingerprint: passwordResetCredentialFingerprint(user.passwordHash),
  }, PASSWORD_RESET_TTL_SECONDS);
}

export async function verifyPasswordResetToken(token: string): Promise<PasswordResetClaims | null> {
  const payload = await verifyScopedToken(token, passwordResetPolicy, [PASSWORD_RESET_TTL_SECONDS]);
  if (!payload || parsePasswordResetUserId(payload.sub) === null ||
    !validPasswordResetEmail(payload.email) || !validSessionVersion(payload.sessionVersion) ||
    typeof payload.credentialFingerprint !== "string" || !/^[0-9a-f]{64}$/.test(payload.credentialFingerprint)) return null;
  return {
    userId: payload.sub, email: payload.email, jti: payload.jti, sessionVersion: payload.sessionVersion,
    credentialFingerprint: payload.credentialFingerprint, expiresAt: payload.expiresAt,
  };
}

export function createPasswordResetUrl(token: string) {
  return createAuthUrl("/reset-password", token, "Password reset URLs must use HTTPS outside development.");
}

const TEACHER_INVITATION_TTL_SECONDS = 3600;
const teacherInvitationPolicy = {
  issuer: "isms-teacher-invitation", audience: "teacher-activation", scope: "teacher-invitation",
  secretVariable: "TEACHER_INVITATION_SECRET",
  secretError: "Teacher invitations require a secret of at least 32 bytes.",
};
export type TeacherInvitationClaims = { employeeRecordId: string; email: string; jti: string; expiresAt: Date };

export { validPasswordResetEmail as validTeacherInvitationEmail };

export async function createTeacherInvitationToken(employeeRecordId: string, email: string, options: { ttlSeconds?: 1800 | 3600 } = {}) {
  if (parseRecordId(employeeRecordId, { canonical: true, maxDigits: 19 }) === null || !validPasswordResetEmail(email)) throw new Error("Invalid teacher invitation.");
  const ttlSeconds = options.ttlSeconds ?? TEACHER_INVITATION_TTL_SECONDS;
  if (ttlSeconds !== 1800 && ttlSeconds !== TEACHER_INVITATION_TTL_SECONDS) throw new Error("Invalid teacher invitation lifetime.");
  return createScopedToken(teacherInvitationPolicy, employeeRecordId, { email }, ttlSeconds);
}

export async function verifyTeacherInvitationToken(token: string): Promise<TeacherInvitationClaims | null> {
  const payload = await verifyScopedToken(token, teacherInvitationPolicy, [1800, TEACHER_INVITATION_TTL_SECONDS]);
  if (!payload || parseRecordId(payload.sub, { canonical: true, maxDigits: 19 }) === null || !validPasswordResetEmail(payload.email)) return null;
  return { employeeRecordId: payload.sub, email: payload.email, jti: payload.jti, expiresAt: payload.expiresAt };
}

export function createTeacherInvitationUrl(token: string) {
  return createAuthUrl("/teacher/activate", token, "Teacher invitation URLs must use HTTPS outside development.");
}
