"use server";

import {
  confirmEmailVerification,
  sendEmailVerification,
  type EmailVerificationState,
} from "@/lib/auth/email-verification";

export async function sendVerificationEmailAction(previousState: EmailVerificationState, formData: FormData) {
  return sendEmailVerification(previousState, formData);
}

export async function confirmEmailVerificationAction(previousState: EmailVerificationState, formData: FormData) {
  return confirmEmailVerification(previousState, formData);
}
