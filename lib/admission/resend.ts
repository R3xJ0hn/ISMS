import nodemailer from "nodemailer";
import { Resend } from "resend";

type SendStudentUpdateLinkEmailInput = {
  to: string;
  studentName: string;
  updateUrl: string;
};

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  return new Resend(apiKey);
}

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
    auth: {
      user,
      pass,
    },
  });

}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return character;
    }
  });
}

function sanitizeText(value: string) {
  return value.replace(/[\u0000-\u001F\u007F]/g, " ").trim();
}

function sanitizeUpdateUrl(updateUrl: string) {
  try {
    const url = new URL(updateUrl);

    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString();
    }
  } catch {
    // Fall through to a harmless placeholder.
  }

  return "#";
}

function buildStudentUpdateEmail(studentName: string, updateUrl: string) {
  const safeStudentName = sanitizeText(studentName);
  const safeUpdateUrl = sanitizeUpdateUrl(updateUrl);
  const htmlStudentName = escapeHtml(safeStudentName);
  const htmlUpdateUrl = escapeHtml(safeUpdateUrl);

  return {
    subject: "Update your DCSA student information",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <p>Hello ${htmlStudentName},</p>
        <p>We verified your student record. Use the secure link below to update your saved information.</p>
        <p>
          <a href="${htmlUpdateUrl}" style="display: inline-block; background: #0f766e; color: #ffffff; padding: 12px 18px; border-radius: 8px; text-decoration: none; font-weight: 600;">
            Update student information
          </a>
        </p>
        <p>This link expires in 1 hour.</p>
      </div>
    `,
    text: [
      `Hello ${safeStudentName},`,
      "",
      "We verified your student record.",
      "Use this secure link to update your saved information:",
      safeUpdateUrl,
      "",
      "This link expires in 1 hour.",
    ].join("\n"),
  };
}

export async function sendStudentUpdateLinkEmail({
  to,
  studentName,
  updateUrl,
}: SendStudentUpdateLinkEmailInput) {
  const message = buildStudentUpdateEmail(studentName, updateUrl);

  if (shouldUseSmtp()) {
    const transporter = getSmtpTransporter();

    await transporter.sendMail({
      from: getFromEmail(),
      to,
      ...message,
    });

    return;
  }

  const resend = getResendClient();
  const { error } = await resend.emails.send({
    from: getFromEmail(),
    to,
    ...message,
  });

  if (error) {
    throw new Error(error.message || "Failed to send the update link email.");
  }
}
