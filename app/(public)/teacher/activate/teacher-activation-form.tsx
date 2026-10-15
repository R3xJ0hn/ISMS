"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TeacherFormState } from "@/lib/teachers/validation";
import { activateTeacherAction } from "./actions";

const initialState: TeacherFormState = { success: false, message: "" };

export function TeacherActivationForm({ token, record }: {
  token: string;
  record: { employeeRecordId: string; fullName: string; emailAddress: string } | null;
}) {
  const [state, formAction, pending] = useActionState(activateTeacherAction, initialState);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmationRef = useRef<HTMLInputElement>(null);
  const errors = state.fieldErrors;

  useEffect(() => {
    if (!state.message) return;
    if (passwordRef.current) passwordRef.current.value = "";
    if (confirmationRef.current) confirmationRef.current.value = "";
  }, [state]);

  if (state.success) {
    return (
      <div className="space-y-5">
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-950">Your teacher account is ready</h1>
        <p role="status" className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm leading-6 text-green-700">{state.message}</p>
        <Button asChild className="h-11 w-full"><Link href="/login" prefetch={false}>Sign in to your teacher account</Link></Button>
      </div>
    );
  }
  if (!record) {
    return (
      <div className="space-y-5">
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-950">This account setup email is unavailable</h1>
        <p className="text-sm leading-6 text-gray-600">The account setup has expired, was already completed, or is no longer valid. Please ask your administrator to resend it.</p>
        <Link href="/login" className="block text-center text-sm font-medium text-primary underline underline-offset-4">Back to sign in</Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-950">Welcome, {record.fullName}</h1>
      <p className="mt-3 text-sm leading-6 text-gray-600">Choose your password to verify your email and create your teacher account.</p>
      <p className="mb-6 mt-2 break-all font-semibold text-gray-950">{record.emailAddress}</p>
      <form action={formAction} aria-busy={pending} className="space-y-5">
        <input type="hidden" name="token" value={token} />
        {state.message && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">{state.message}</p>}
        {errors?.token && <p role="alert" className="text-sm text-destructive">{errors.token}</p>}
        <fieldset disabled={pending} className="space-y-5">
          <legend className="sr-only">Choose your password</legend>
          <div className="space-y-2">
            <label htmlFor="teacher-activation-password" className="block text-sm font-medium text-gray-950">Password <span className="text-destructive">*</span></label>
            <Input ref={passwordRef} id="teacher-activation-password" name="password" type="password" required minLength={8}
              autoComplete="new-password" autoCapitalize="none" spellCheck={false} aria-invalid={Boolean(errors?.password)}
              aria-describedby={["teacher-activation-password-help", errors?.password ? "teacher-activation-password-error" : ""].filter(Boolean).join(" ")}
            />
            <p id="teacher-activation-password-help" className="text-xs leading-5 text-gray-500">Use at least 8 characters with uppercase and lowercase letters, a number, and a symbol.</p>
            {errors?.password && <p id="teacher-activation-password-error" className="text-sm text-destructive">{errors.password}</p>}
          </div>
          <div className="space-y-2">
            <label htmlFor="teacher-activation-confirmPassword" className="block text-sm font-medium text-gray-950">Confirm password <span className="text-destructive">*</span></label>
            <Input ref={confirmationRef} id="teacher-activation-confirmPassword" name="confirmPassword" type="password" required
              autoComplete="new-password" autoCapitalize="none" spellCheck={false} aria-invalid={Boolean(errors?.confirmPassword)}
              aria-describedby={errors?.confirmPassword ? "teacher-activation-confirmPassword-error" : undefined}
            />
            {errors?.confirmPassword && <p id="teacher-activation-confirmPassword-error" className="text-sm text-destructive">{errors.confirmPassword}</p>}
          </div>
        </fieldset>
        <Button type="submit" disabled={pending} className="h-11 w-full"><ShieldCheck aria-hidden="true" />{pending ? "Activating..." : "Verify email and activate account"}</Button>
      </form>
    </div>
  );
}
