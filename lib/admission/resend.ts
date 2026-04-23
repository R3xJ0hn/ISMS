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
  return process.env.RESEND_FROM_EMAIL ?? "DCSA Admissions <onboarding@resend.dev>";
}

export async function sendStudentUpdateLinkEmail({
  to,
  studentName,
  updateUrl,
}: SendStudentUpdateLinkEmailInput) {
  const resend = getResendClient();
  const { error } = await resend.emails.send({
    from: getFromEmail(),
    to,
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
        <p>If the button does not work, copy and open this link:</p>
        <p><a href="${updateUrl}">${updateUrl}</a></p>
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
  });

  if (error) {
    throw new Error(error.message || "Failed to send the update link email.");
  }
}
