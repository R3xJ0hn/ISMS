import { requireAuthenticatedSession } from "@/lib/auth";
import { Prisma } from "@/lib/generated/prisma/client";
import { VerificationTokenPurpose } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { readFormValue } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { sendEmailVerificationEmail } from "./email";
import {
  createEmailVerificationToken, createEmailVerificationUrl, parseVerificationUserId, validVerificationEmail,
  verifyEmailVerificationToken, type EmailVerificationClaims,
} from "./tokens";

export type EmailVerificationState = { success: boolean; message: string };
const invalidLink: EmailVerificationState = { success: false, message: "This verification link is invalid, expired, or already used. Request a new verification email." };
const sendFailure: EmailVerificationState = { success: false, message: "We could not send the verification email. Please try again." };
const tokenSelection = { purpose: true, userId: true, expiresAt: true, consumedAt: true } as const;
type VerificationRecord = Prisma.VerificationTokenGetPayload<{ select: typeof tokenSelection }>;

function usableRecord(record: VerificationRecord | null, claims: EmailVerificationClaims, now: Date) {
  return record !== null && record.purpose === VerificationTokenPurpose.emailVerification &&
    record.userId === BigInt(claims.userId) &&
    record.consumedAt === null && record.expiresAt > now && record.expiresAt.getTime() === claims.expiresAt.getTime();
}

type VerificationRequest =
  | { kind: "state"; state: EmailVerificationState }
  | { kind: "send"; email: string; userId: bigint; jti: string; verificationUrl: string };

export async function sendEmailVerification(
  _previousState: EmailVerificationState,
  _formData: FormData,
): Promise<EmailVerificationState> {
  const session = await requireAuthenticatedSession();
  void _previousState;
  void _formData;
  const userId = parseVerificationUserId(session.id);
  if (userId === null) return { success: false, message: "Unable to verify this account. Sign in again." };

  let request: VerificationRequest;
  try {
    request = await prisma.$transaction(async (tx): Promise<VerificationRequest> => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { email: true, emailVerified: true } });
      if (!user || user.email !== session.email || !validVerificationEmail(user.email)) {
        return { kind: "state", state: { success: false, message: "Your account details changed. Sign in again and request a new verification email." } };
      }
      if (user.emailVerified) return { kind: "state", state: { success: true, message: "Your email address is already verified." } };

      const now = new Date();
      const recent = await tx.verificationToken.findFirst({
        where: {
          purpose: VerificationTokenPurpose.emailVerification, userId,
          createdAt: { gt: new Date(now.getTime() - 60_000) },
        },
        select: { id: true },
      });
      if (recent) return { kind: "state", state: { success: false, message: "Please wait 60 seconds before requesting another verification email." } };

      const issued = await createEmailVerificationToken(userId.toString(), user.email);
      const verificationUrl = createEmailVerificationUrl(issued.token);
      await tx.verificationToken.updateMany({
        where: { purpose: VerificationTokenPurpose.emailVerification, userId, consumedAt: null },
        data: { consumedAt: now },
      });
      await tx.verificationToken.create({
        data: {
          jti: issued.jti, purpose: VerificationTokenPurpose.emailVerification,
          userId, expiresAt: issued.expiresAt,
        },
      });
      return { kind: "send", email: user.email, userId, jti: issued.jti, verificationUrl };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch {
    return sendFailure;
  }
  if (request.kind === "state") return request.state;

  try {
    await sendEmailVerificationEmail({ to: request.email, verificationUrl: request.verificationUrl });
  } catch {
    try {
      await prisma.verificationToken.deleteMany({
        where: { jti: request.jti, purpose: VerificationTokenPurpose.emailVerification, userId: request.userId },
      });
    } catch {
      // Keep failures private; cleanup is limited to this failed delivery's token.
    }
    return sendFailure;
  }
  return { success: true, message: "Verification email sent. Check your inbox. The link expires in 1 hour." };
}

export async function getEmailVerificationRecord(token: string): Promise<{ email: string } | null> {
  const claims = await verifyEmailVerificationToken(token);
  if (!claims) return null;
  try {
    const record = await prisma.verificationToken.findUnique({ where: { jti: claims.jti }, select: tokenSelection });
    if (!usableRecord(record, claims, new Date())) return null;
    const user = await prisma.user.findUnique({ where: { id: BigInt(claims.userId) }, select: { email: true, emailVerified: true } });
    return user && user.email === claims.email && !user.emailVerified ? { email: user.email } : null;
  } catch {
    return null;
  }
}

class VerificationChanged extends Error {}

export async function confirmEmailVerification(
  _previousState: EmailVerificationState,
  formData: FormData,
): Promise<EmailVerificationState> {
  const claims = await verifyEmailVerificationToken(readFormValue(formData, "token"));
  if (!claims) return invalidLink;
  let result: EmailVerificationState;
  try {
    result = await prisma.$transaction(async (tx): Promise<EmailVerificationState> => {
      const now = new Date();
      const record = await tx.verificationToken.findUnique({ where: { jti: claims.jti }, select: tokenSelection });
      if (!usableRecord(record, claims, now)) return invalidLink;
      const userId = BigInt(claims.userId);
      const user = await tx.user.findUnique({ where: { id: userId }, select: { email: true, emailVerified: true } });
      if (!user || user.email !== claims.email || user.emailVerified) return invalidLink;
      const consumed = await tx.verificationToken.updateMany({
        where: {
          jti: claims.jti, purpose: VerificationTokenPurpose.emailVerification, userId,
          consumedAt: null, expiresAt: { gt: now },
        },
        data: { consumedAt: now },
      });
      if (consumed.count !== 1) return invalidLink;
      const verified = await tx.user.updateMany({
        where: { id: userId, email: claims.email, emailVerified: false }, data: { emailVerified: true },
      });
      if (verified.count !== 1) throw new VerificationChanged();
      return { success: true, message: "Your email address is verified. You can now continue to the portal." };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    return error instanceof VerificationChanged ? invalidLink : { success: false, message: "We could not verify your email right now. Please try again." };
  }
  if (result.success) revalidatePath("/portal", "layout");
  return result;
}
