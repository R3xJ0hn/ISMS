"use server";

import { requestPasswordReset } from "@/lib/auth/password-reset";
import type { PasswordResetFormState } from "@/lib/auth/password-reset-validation";

export async function requestPasswordResetAction(previousState: PasswordResetFormState, formData: FormData) {
  return requestPasswordReset(previousState, formData);
}
