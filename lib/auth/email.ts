import { sendEmail } from "@/lib/email";
import { escapeHtml, sanitizeText } from "@/lib/utils";
import { validateAuthUrl } from "./tokens";

export function buildEmailVerificationEmail(email: string, verificationUrl: string) {
  const url = validateAuthUrl(verificationUrl, "Invalid email verification URL.");
  const safeEmail = sanitizeText(email);
  const safeUrl = url.toString();
  return {
    subject: "Verify your ISMS email address",
    html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
      <p>Verify ${escapeHtml(safeEmail)} to access the ISMS portal.</p>
      <p><a href="${escapeHtml(safeUrl)}" style="display: inline-block; background: #0f766e; color: #ffffff; padding: 12px 18px; border-radius: 8px; text-decoration: none; font-weight: 600;">Verify email address</a></p>
      <p>This link expires in 1 hour. Open it and confirm verification to continue.</p>
      <p>If you did not request this email, you can ignore it.</p>
    </div>`,
    text: [
      `Verify ${safeEmail} to access the ISMS portal.`, "", safeUrl, "",
      "This link expires in 1 hour. Open it and confirm verification to continue.",
      "If you did not request this email, you can ignore it.",
    ].join("\n"),
  };
}

export async function sendEmailVerificationEmail({ to, verificationUrl }: { to: string; verificationUrl: string }) {
  await sendEmail({ to, ...buildEmailVerificationEmail(to, verificationUrl) }, "Failed to send the verification email.");
}

export function buildPasswordResetEmail(email: string, resetUrl: string) {
  const url = validateAuthUrl(resetUrl, "Invalid password reset URL.");
  const address = sanitizeText(email);
  const link = url.toString();
  return {
    subject: "Set or reset your ISMS password",
    html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
      <p>Instructions to set or reset a password were requested for ${escapeHtml(address)}.</p>
      <p><a href="${escapeHtml(link)}">Choose your password</a></p>
      <p>This link expires in 30 minutes and can be used once. Updating an existing password signs out existing sessions.</p>
      <p>If you did not request this email, you can ignore it.</p></div>`,
    text: [`Instructions to set or reset a password were requested for ${address}.`, "", "Choose your password:", link, "",
      "This link expires in 30 minutes and can be used once. Updating an existing password signs out existing sessions.",
      "If you did not request this email, you can ignore it."].join("\n"),
  };
}
export async function sendPasswordResetEmail({ to, resetUrl }: { to: string; resetUrl: string }) {
  await sendEmail({ to, ...buildPasswordResetEmail(to, resetUrl) }, "Failed to send the password reset email.");
}

export function buildPasswordChangedEmail(email: string) {
  const address = sanitizeText(email);
  const information = "If you did not make this change, request another password reset or contact your administrator.";
  return {
    subject: "Your ISMS password was changed",
    html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;"><p>The password for ${escapeHtml(address)} was changed.</p><p>${information}</p></div>`,
    text: [`The password for ${address} was changed.`, "", information].join("\n"),
  };
}
export async function sendPasswordChangedEmail({ to }: { to: string }) {
  await sendEmail({ to, ...buildPasswordChangedEmail(to) }, "Failed to send the password-change notification.");
}

export function buildTeacherInvitationEmail(fullName: string, invitationUrl: string) {
  const url = validateAuthUrl(invitationUrl, "Invalid teacher invitation URL.");
  const name = sanitizeText(fullName);
  const link = url.toString();
  const requestDescription = "Your administrator requested an ISMS teacher account for you.";
  return {
    subject: "Activate your ISMS teacher account",
    html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
      <p>Hello ${escapeHtml(name)},</p><p>${requestDescription}</p>
      <p><a href="${escapeHtml(link)}">Verify your email and create your password</a></p>
      <p>This link expires in 1 hour and can be used once. Your account will be created after you choose your password.</p>
      <p>If you were not expecting this account setup email, you can ignore it.</p></div>`,
    text: [`Hello ${name},`, "", requestDescription,
      "Verify your email and choose your own password:", link, "",
      "This link expires in 1 hour and can be used once. Your account will be created after you choose your password.",
      "If you were not expecting this account setup email, you can ignore it."].join("\n"),
  };
}

export async function sendTeacherInvitationEmail({ to, fullName, invitationUrl }: { to: string; fullName: string; invitationUrl: string }) {
  await sendEmail({ to, ...buildTeacherInvitationEmail(fullName, invitationUrl) }, "Failed to send the teacher account setup email.");
}
