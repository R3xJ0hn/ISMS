import nodemailer from "nodemailer";
import { Resend } from "resend";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

function getFromEmail() {
  return (
    process.env.SMTP_FROM_EMAIL ??
    process.env.RESEND_FROM_EMAIL ??
    "Portal <onboarding@resend.dev>"
  );
}

function shouldUseSmtp() {
  return Boolean(process.env.SMTP_HOST);
}

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  return new Resend(apiKey);
}

function getSmtpTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number.parseInt(process.env.SMTP_PORT ?? "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass || Number.isNaN(port)) {
    throw new Error(
      "SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS must be configured for SMTP email."
    );
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendEmail(message: EmailMessage) {
  if (shouldUseSmtp()) {
    const transporter = getSmtpTransporter();

    await transporter.sendMail({
      from: getFromEmail(),
      ...message,
    });

    return;
  }

  const resend = getResendClient();

  const { error } = await resend.emails.send({
    from: getFromEmail(),
    ...message,
  });

  if (error) {
    throw new Error(error.message || "Failed to send email.");
  }
}