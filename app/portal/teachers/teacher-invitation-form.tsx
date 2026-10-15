"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TeacherFormState } from "@/lib/teachers/validation";
import { useActionToast } from "@/components/portal/toasts";
import { sendTeacherSetupEmailAction } from "./actions";
import type { TeacherTableRow } from "./teachers-table";

type SetupEmailFormProps = {
  teacher: TeacherTableRow;
  compact?: boolean;
};

const initialState: TeacherFormState = { success: false, message: "" };

export function TeacherSetupEmailForm({ teacher, compact = false }: SetupEmailFormProps) {
  const router = useRouter();
  const errorId = useId();
  const [state, formAction, pending] = useActionState(sendTeacherSetupEmailAction, initialState);
  useActionToast(state);
  const error = state.fieldErrors?.employeeRecordId;

  useEffect(() => {
    if (!state.success) return;
    if (!compact) router.push("/portal/teachers");
    router.refresh();
  }, [compact, state, router]);

  if (teacher.accountStatus === "Active") return <p className="text-sm text-muted-foreground">This teacher has activated their portal account.</p>;
  if (teacher.status === "Resigned") return <p className="text-sm text-muted-foreground">Account setup is unavailable for resigned employees.</p>;
  if (teacher.accountStatus === "Account Conflict") return <p className="text-sm text-muted-foreground">An existing account uses this employee&apos;s email address. Review the employee profile before sending an account setup email.</p>;

  const label = teacher.accountStatus === "Not Activated" ? "Send account setup email" : "Resend setup email";
  return (
    <form action={formAction} aria-busy={pending} className={compact ? "space-y-2" : "w-full max-w-2xl space-y-5"}>
      <input type="hidden" name="employeeRecordId" value={teacher.employeeRecordId} />
      {!compact && <p className="text-sm leading-6 text-muted-foreground">Send an account setup email to <span className="font-semibold text-foreground">{teacher.emailAddress}</span>. The teacher verifies their email and creates their own password.</p>}
      {error && <p id={errorId} role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        {!compact && <Button asChild variant="outline"><Link href="/portal/teachers">Cancel</Link></Button>}
        <Button type="submit" size={compact ? "sm" : "default"} disabled={pending} aria-describedby={error ? errorId : undefined}>
          <Mail aria-hidden="true" />{pending ? "Sending..." : label}
        </Button>
      </div>
    </form>
  );
}
