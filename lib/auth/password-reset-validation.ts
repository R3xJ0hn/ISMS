import { normalizeEmail, readFormValue } from "@/lib/utils";
import { getPasswordValidationError, validateEmail } from "@/lib/validation";

export type PasswordResetFormState = {
  success: boolean;
  message: string;
  fieldErrors?: Partial<Record<"email" | "token" | "password" | "confirmPassword", string>>;
};
type Failure = PasswordResetFormState & { success: false };

export function parsePasswordResetRequest(formData: FormData): Failure | { success: true; email: string } {
  const email = normalizeEmail(readFormValue(formData, "email"));
  return !email || email.length > 320 || !validateEmail(email)
    ? { success: false, message: "Enter a valid email address.", fieldErrors: { email: "Enter a valid email address of up to 320 characters." } }
    : { success: true, email };
}

export function parsePasswordResetSubmission(formData: FormData): Failure | { success: true; token: string; password: string } {
  return parsePasswordSetupSubmission(formData, "Use a valid password reset link.");
}

/** Password setup and reset share the same raw credential and UTF-8 length rules. */
export function parsePasswordSetupSubmission(
  formData: FormData,
  invalidTokenMessage: string,
): Failure | { success: true; token: string; password: string } {
  const token = readFormValue(formData, "token");
  const password = readFormValue(formData, "password");
  const confirmPassword = readFormValue(formData, "confirmPassword");
  const fieldErrors: NonNullable<PasswordResetFormState["fieldErrors"]> = {};
  if (!token || token.length > 4096) fieldErrors.token = invalidTokenMessage;
  if (!password) fieldErrors.password = "Enter a password.";
  if (!confirmPassword) fieldErrors.confirmPassword = "Confirm the password.";
  const passwordError = getPasswordValidationError(password, confirmPassword);
  if (password && confirmPassword && passwordError) {
    fieldErrors[passwordError === "Passwords do not match." ? "confirmPassword" : "password"] = passwordError;
  }
  if (new TextEncoder().encode(password).length > 72) fieldErrors.password = "Password must be no more than 72 UTF-8 bytes.";
  return Object.keys(fieldErrors).length
    ? { success: false, message: "Check the highlighted fields.", fieldErrors }
    : { success: true, token, password };
}
