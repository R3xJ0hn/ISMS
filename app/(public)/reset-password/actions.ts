"use server";

import { resetPassword } from "@/lib/auth/password-reset";
import type { PasswordResetFormState } from "@/lib/auth/password-reset-validation";

export async function resetPasswordAction(previousState: PasswordResetFormState, formData: FormData) {
  return resetPassword(previousState, formData);
}
