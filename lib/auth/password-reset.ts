import { timingSafeEqual } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { after } from "next/server";
import { Prisma } from "@/lib/generated/prisma/client";
import { VerificationTokenPurpose } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { literalInsensitiveEquality, normalizeEmail } from "@/lib/utils";
import { activateTeacher, getTeacherActivationRecord } from "@/lib/teachers/activation";
import { requestTeacherPasswordSetup } from "@/lib/teachers/password-setup";
import { hashPassword } from "./credentials";
import { sendPasswordChangedEmail, sendPasswordResetEmail } from "./email";
import { recordPasswordResetAttempt } from "./password-reset-rate-limit";
import {
  createPasswordResetToken, createPasswordResetUrl, passwordResetCredentialFingerprint,
  validPasswordResetEmail, verifyPasswordResetToken, type PasswordResetClaims,
} from "./tokens";
import { parsePasswordResetRequest, parsePasswordResetSubmission, type PasswordResetFormState } from "./password-reset-validation";

const requestResponse: PasswordResetFormState = { success: true, message: "If your email is registered with the school, we’ve sent instructions to set or reset your password." };
export const PASSWORD_RESET_MIN_RESPONSE_MS = 200;
const invalid: PasswordResetFormState = {
  success: false, message: "This password reset link is invalid, expired, already used, or no longer available. Request a new reset email.",
  fieldErrors: { token: "Use a current password reset link." },
};
const tokenSelect = { purpose: true, userId: true, expiresAt: true, consumedAt: true } as const;
const accountSelect = { id: true, email: true, passwordHash: true, sessionVersion: true } as const;
type TokenRecord = Prisma.VerificationTokenGetPayload<{ select: typeof tokenSelect }>;
type Account = Prisma.UserGetPayload<{ select: typeof accountSelect }>;

function usable(record: TokenRecord | null, claims: PasswordResetClaims, now: Date) {
  return record !== null && record.purpose === VerificationTokenPurpose.passwordReset && record.userId !== null && record.userId.toString() === claims.userId &&
    record.consumedAt === null && record.expiresAt > now && record.expiresAt.getTime() === claims.expiresAt.getTime();
}
function matchesAccount(user: Account | null, claims: PasswordResetClaims): user is Account {
  return user !== null && normalizeEmail(user.email) === claims.email && user.sessionVersion === claims.sessionVersion &&
    user.sessionVersion < 2147483647 && timingSafeEqual(Buffer.from(passwordResetCredentialFingerprint(user.passwordHash), "hex"), Buffer.from(claims.credentialFingerprint, "hex"));
}

type ResetRequest = { userId: bigint; jti: string; email: string; resetUrl: string } | null;
type RequestOutcome = ResetRequest | { needsAccountSetup: true };

async function processPasswordResetRequest(email: string) {
  let request: RequestOutcome;
  try {
    request = await prisma.$transaction(async (tx): Promise<RequestOutcome> => {
      const accounts = await tx.user.findMany({ where: { email: literalInsensitiveEquality(email) }, select: { id: true }, take: 2 });
      if (accounts.length === 0) return { needsAccountSetup: true };
      if (accounts.length !== 1) return null;
      const userId = accounts[0].id;
      const locked = await tx.$queryRaw<Array<{ id: bigint }>>(Prisma.sql`SELECT "id" FROM "users" WHERE "id" = ${userId} FOR UPDATE`);
      if (locked.length !== 1) return null;
      const user = await tx.user.findUnique({ where: { id: userId }, select: accountSelect });
      if (!user || normalizeEmail(user.email) !== email || !validPasswordResetEmail(email) || user.sessionVersion >= 2147483647) return null;
      const now = new Date();
      const recent = await tx.verificationToken.findFirst({ where: {
        purpose: VerificationTokenPurpose.passwordReset, userId, createdAt: { gt: new Date(now.getTime() - 60_000) },
      }, select: { id: true } });
      if (recent) return null;
      const issued = await createPasswordResetToken({ id: user.id.toString(), email, passwordHash: user.passwordHash, sessionVersion: user.sessionVersion });
      const resetUrl = createPasswordResetUrl(issued.token);
      await tx.verificationToken.updateMany({ where: { purpose: VerificationTokenPurpose.passwordReset, userId, consumedAt: null }, data: { consumedAt: now } });
      await tx.verificationToken.create({ data: { jti: issued.jti, purpose: VerificationTokenPurpose.passwordReset, userId, expiresAt: issued.expiresAt } });
      return { userId, jti: issued.jti, email, resetUrl };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch { return; }
  if (!request) return;
  if ("needsAccountSetup" in request) {
    // A first password can only be chosen after proving an eligible saved
    // teacher's email. The setup helper rechecks eligibility in its own transaction.
    try { await requestTeacherPasswordSetup(email); } catch { /* Keep failed account setup requests private. */ }
    return;
  }
  try { await sendPasswordResetEmail({ to: request.email, resetUrl: request.resetUrl }); }
  catch {
    try { await prisma.verificationToken.deleteMany({ where: {
      jti: request.jti, purpose: VerificationTokenPurpose.passwordReset, userId: request.userId, consumedAt: null,
    } }); } catch { /* Cleanup never exposes provider or account details. */ }
  }
}

export async function requestPasswordReset(_previousState: PasswordResetFormState, formData: FormData): Promise<PasswordResetFormState> {
  const parsed = parsePasswordResetRequest(formData);
  if (!parsed.success) return parsed;
  const startedAt = Date.now();
  try {
    // Only registration-independent rate buckets run before returning. Account
    // lookup, locking, token issuance and SMTP all run after the response ends.
    if (await recordPasswordResetAttempt(parsed.email)) after(() => processPasswordResetRequest(parsed.email));
  } catch { /* Registered, unavailable and throttled addresses get the same response. */ }
  finally {
    const remaining = PASSWORD_RESET_MIN_RESPONSE_MS - (Date.now() - startedAt);
    if (remaining > 0) await delay(remaining);
  }
  return requestResponse;
}

export async function getPasswordResetRecord(token: string): Promise<{ email: string; accountSetup?: boolean } | null> {
  const claims = await verifyPasswordResetToken(token);
  if (!claims) {
    try {
      const teacher = await getTeacherActivationRecord(token);
      return teacher ? { email: teacher.emailAddress, accountSetup: true } : null;
    } catch { return null; }
  }
  try {
    const record = await prisma.verificationToken.findUnique({ where: { jti: claims.jti }, select: tokenSelect });
    if (!usable(record, claims, new Date())) return null;
    const user = await prisma.user.findUnique({ where: { id: BigInt(claims.userId) }, select: accountSelect });
    return matchesAccount(user, claims) ? { email: claims.email } : null;
  } catch { return null; }
}

class ResetChanged extends Error {}

export async function resetPassword(_previousState: PasswordResetFormState, formData: FormData): Promise<PasswordResetFormState> {
  const parsed = parsePasswordResetSubmission(formData);
  if (!parsed.success) return parsed;
  const claims = await verifyPasswordResetToken(parsed.token);
  if (!claims) {
    try {
      const setup = await activateTeacher({ success: false, message: "" }, formData);
      if (setup.success) return { success: true, message: "Your teacher account is ready. Sign in with your email and new password." };
      if (setup.fieldErrors?.token) return invalid;
      const fieldErrors: NonNullable<PasswordResetFormState["fieldErrors"]> = {};
      if (setup.fieldErrors?.password) fieldErrors.password = setup.fieldErrors.password;
      if (setup.fieldErrors?.confirmPassword) fieldErrors.confirmPassword = setup.fieldErrors.confirmPassword;
      return Object.keys(fieldErrors).length
        ? { success: false, message: "Check the highlighted fields.", fieldErrors }
        : { success: false, message: "We could not set your password. Try again or request a new email." };
    } catch {
      return { success: false, message: "We could not set your password. Try again or request a new email." };
    }
  }
  let result: PasswordResetFormState;
  try {
    result = await prisma.$transaction(async (tx): Promise<PasswordResetFormState> => {
      const record = await tx.verificationToken.findUnique({ where: { jti: claims.jti }, select: tokenSelect });
      if (!usable(record, claims, new Date())) return invalid;
      const userId = BigInt(claims.userId);
      const locked = await tx.$queryRaw<Array<{ id: bigint }>>(Prisma.sql`SELECT "id" FROM "users" WHERE "id" = ${userId} FOR UPDATE`);
      if (locked.length !== 1) return invalid;
      const user = await tx.user.findUnique({ where: { id: userId }, select: accountSelect });
      if (!matchesAccount(user, claims)) return invalid;
      const passwordHash = await hashPassword(parsed.password);
      const consumed = await tx.verificationToken.updateMany({ where: {
        jti: claims.jti, purpose: VerificationTokenPurpose.passwordReset, userId, consumedAt: null,
        expiresAt: { gt: new Date(), equals: claims.expiresAt },
      }, data: { consumedAt: new Date() } });
      if (consumed.count !== 1) return invalid;
      const updated = await tx.user.updateMany({ where: {
        id: userId, email: user.email, passwordHash: user.passwordHash, sessionVersion: claims.sessionVersion,
      }, data: { email: claims.email, passwordHash, sessionVersion: { increment: 1 }, emailVerified: true } });
      if (updated.count !== 1) throw new ResetChanged();
      await tx.verificationToken.updateMany({ where: {
        purpose: VerificationTokenPurpose.passwordReset, userId, jti: { not: claims.jti }, consumedAt: null,
      }, data: { consumedAt: new Date() } });
      return { success: true, message: "Your password has been reset. Sign in with your new password." };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    return error instanceof ResetChanged ? invalid : { success: false, message: "We could not reset your password. Try again or request a new reset email." };
  }
  if (result.success) {
    try {
      after(async () => {
        try { await sendPasswordChangedEmail({ to: claims.email }); }
        catch { console.error("Failed to send the password-change notification."); }
      });
    } catch { console.error("Failed to schedule the password-change notification."); }
  }
  return result;
}
