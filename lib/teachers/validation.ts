import { parseRecordId, readFormText } from "@/lib/utils";
import { parsePasswordSetupSubmission } from "@/lib/auth/password-reset-validation";

export type TeacherFormState = {
  success: boolean;
  message: string;
  fieldErrors?: Partial<Record<"employeeRecordId" | "token" | "password" | "confirmPassword", string>>;
};
type Failure = TeacherFormState & { success: false };

export function parseTeacherEmployeeId(value: string): bigint | null {
  return parseRecordId(value, { canonical: true, maxDigits: 19 });
}

export function parseTeacherInvitationForm(formData: FormData): Failure | { success: true; employeeId: bigint } {
  const employeeId = parseTeacherEmployeeId(readFormText(formData, "employeeRecordId"));
  return employeeId === null
    ? { success: false, message: "Choose a valid teacher employee.", fieldErrors: { employeeRecordId: "Choose a valid teacher employee." } }
    : { success: true, employeeId };
}

export function parseTeacherActivationForm(formData: FormData): Failure | { success: true; token: string; password: string } {
  return parsePasswordSetupSubmission(formData, "Use a valid account setup link.");
}
