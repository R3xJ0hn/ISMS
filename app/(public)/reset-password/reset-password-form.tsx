"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PasswordResetFormState } from "@/lib/auth/password-reset-validation";
import { resetPasswordAction } from "./actions";

const initialState: PasswordResetFormState = { success: false, message: "" };

export function ResetPasswordForm({ token, record }: { token: string; record: { email: string; accountSetup?: boolean } | null }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, initialState);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmationRef = useRef<HTMLInputElement>(null);
  const [accountSetup] = useState(record?.accountSetup === true);
  const errors = state.fieldErrors;

  useEffect(() => {
    if (!state.message) return;
    if (passwordRef.current) passwordRef.current.value = "";
    if (confirmationRef.current) confirmationRef.current.value = "";
  }, [state]);

  if (state.success) {
    return (
      <div className="space-y-5">
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-950">{accountSetup ? "Teacher account ready" : "Password updated"}</h1>
        <p role="status" className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm leading-6 text-green-700">{state.message}</p>
        <Button asChild className="h-11 w-full"><Link href="/login" prefetch={false}>Sign in with your new password</Link></Button>
      </div>
    );
  }
  if (!record) {
    return (
      <div className="space-y-5">
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-950">This password reset link is unavailable</h1>
        <p className="text-sm leading-6 text-gray-600">The link has expired, was already used, or is no longer valid. Request a new password reset email to continue.</p>
        <Button asChild className="h-11 w-full"><Link href="/forgot-password">Request a new reset email</Link></Button>
        <Link href="/login" className="block text-center text-sm font-medium text-primary underline underline-offset-4">Back to sign in</Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-950">{accountSetup ? "Create your password" : "Choose a new password"}</h1>
      <p className="mt-3 text-sm leading-6 text-gray-600">{accountSetup ? "Choose a password to activate your teacher account:" : "Reset the password for your portal account:"}</p>
      <p className="mb-6 mt-2 break-all font-semibold text-gray-950">{record.email}</p>
      <form action={formAction} aria-busy={pending} className="space-y-5">
        <input type="hidden" name="token" value={token} />
        {state.message && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">{state.message}</p>}
        {errors?.token && <p role="alert" className="text-sm text-destructive">{errors.token}</p>}
        <fieldset disabled={pending} className="space-y-5">
          <legend className="sr-only">Choose your new password</legend>
          <div className="space-y-2">
            <label htmlFor="reset-password-password" className="block text-sm font-medium text-gray-950">New password <span className="text-destructive">*</span></label>
            <Input ref={passwordRef} id="reset-password-password" name="password" type="password" required minLength={8}
              autoComplete="new-password" autoCapitalize="none" spellCheck={false} aria-invalid={Boolean(errors?.password)}
              aria-describedby={["reset-password-help", errors?.password ? "reset-password-password-error" : ""].filter(Boolean).join(" ")}
            />
            <p id="reset-password-help" className="text-xs leading-5 text-gray-500">Use at least 8 characters with uppercase and lowercase letters, a number, and a symbol.</p>
            {errors?.password && <p id="reset-password-password-error" className="text-sm text-destructive">{errors.password}</p>}
          </div>
          <div className="space-y-2">
            <label htmlFor="reset-password-confirmPassword" className="block text-sm font-medium text-gray-950">Confirm new password <span className="text-destructive">*</span></label>
            <Input ref={confirmationRef} id="reset-password-confirmPassword" name="confirmPassword" type="password" required
              autoComplete="new-password" autoCapitalize="none" spellCheck={false} aria-invalid={Boolean(errors?.confirmPassword)}
              aria-describedby={errors?.confirmPassword ? "reset-password-confirmPassword-error" : undefined}
            />
            {errors?.confirmPassword && <p id="reset-password-confirmPassword-error" className="text-sm text-destructive">{errors.confirmPassword}</p>}
          </div>
        </fieldset>
        <Button type="submit" disabled={pending} className="h-11 w-full"><ShieldCheck aria-hidden="true" />{pending ? "Saving..." : accountSetup ? "Create password" : "Reset password"}</Button>
      </form>
    </div>
  );
}
