"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PasswordResetFormState } from "@/lib/auth/password-reset-validation";
import { cn } from "@/lib/utils";
import { requestPasswordResetAction } from "./actions";

const initialState: PasswordResetFormState = { success: false, message: "" };

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, initialState);
  const error = state.fieldErrors?.email;

  return (
    <form action={formAction} aria-busy={pending} className="space-y-5">
      <fieldset disabled={pending}>
        <legend className="sr-only">Request a password reset email</legend>
        <div className="space-y-2">
          <label htmlFor="forgot-password-email" className="block text-sm font-medium text-gray-950">Email address <span className="text-destructive">*</span></label>
          <Input id="forgot-password-email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required
            maxLength={320} autoComplete="email" autoCapitalize="none" spellCheck={false} aria-invalid={Boolean(error)}
            aria-describedby={error ? "forgot-password-email-error" : undefined}
          />
          {error && <p id="forgot-password-email-error" className="text-sm text-destructive">{error}</p>}
        </div>
      </fieldset>
      {state.message && <p role={state.success ? "status" : "alert"} className={cn("rounded-md border px-4 py-3 text-sm leading-6", state.success ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700")}>{state.message}</p>}
      <Button type="submit" disabled={pending} className="h-11 w-full"><Mail aria-hidden="true" />{pending ? "Sending..." : "Send password reset email"}</Button>
      <Link href="/login" className="block text-center text-sm font-medium text-primary underline underline-offset-4">Back to sign in</Link>
    </form>
  );
}
