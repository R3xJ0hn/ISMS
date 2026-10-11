import { sendEmail } from "@/lib/email";
import { escapeHtml, sanitizeText } from "@/lib/utils";

type SendStudentUpdateLinkEmailInput = {
  to: string;
  studentName: string;
  updateUrl: string;
};

function sanitizeUpdateUrl(updateUrl: string) {
  try {
    const url = new URL(updateUrl);
    const allowHttp = process.env.NODE_ENV === "development";

    if (url.protocol !== "https:" && !(allowHttp && url.protocol === "http:")) {
      throw new Error("Student update URL must use HTTPS outside development.");
    }

    return url.toString();
  } catch {
    throw new Error("Student update URL is invalid.");
  }
}

export function buildStudentUpdateEmail(studentName: string, updateUrl: string) {
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
  await sendEmail({ to, ...message }, "Failed to send the update link email.");
}
