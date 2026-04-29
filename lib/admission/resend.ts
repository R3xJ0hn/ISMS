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

function buildStudentUpdateEmail(studentName: string, updateUrl: string) {
  return {
    subject: "Update your DCSA student information",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <p>Hello ${studentName},</p>
        <p>We verified your student record. Use the secure link below to update your saved information.</p>
        <p>
          <a href="${updateUrl}" style="display: inline-block; background: #0f766e; color: #ffffff; padding: 12px 18px; border-radius: 8px; text-decoration: none; font-weight: 600;">
            Update student information
          </a>
        </p>
        <p>This link expires in 1 hour.</p>
      </div>
    `,
    text: [
      `Hello ${studentName},`,
      "",
      "We verified your student record.",
      "Use this secure link to update your saved information:",
      updateUrl,
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
