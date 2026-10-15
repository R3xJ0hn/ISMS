"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EmailVerificationState } from "@/lib/auth/email-verification";
import { cn } from "@/lib/utils";
import { confirmEmailVerificationAction, sendVerificationEmailAction } from "./actions";

const initialState: EmailVerificationState = { success: false, message: "" };

function VerificationMessage({ state }: { state: EmailVerificationState }) {
  return state.message ? (
    <p role={state.success ? "status" : "alert"} className={cn("rounded-md border px-4 py-3 text-sm leading-6", state.success ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700")}>
      {state.message}
    </p>
  ) : null;
}

export function RequestVerificationForm() {
  const [state, formAction, pending] = useActionState(sendVerificationEmailAction, initialState);

  return (
    <div className="space-y-5">
      <form action={formAction} aria-busy={pending} className="space-y-4">
        <VerificationMessage state={state} />
        <Button type="submit" disabled={pending} className="h-11 w-full">
          <Mail aria-hidden="true" />{pending ? "Sending..." : "Send verification email"}
        </Button>
      </form>
      <p className="text-xs leading-5 text-gray-500">Wait 60 seconds before requesting another email.</p>
      <Button asChild variant="outline" className="h-11 w-full"><Link href="/portal" prefetch={false}>I&apos;ve verified my email</Link></Button>
    </div>
  );
}

export function ConfirmationForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(confirmEmailVerificationAction, initialState);

  return (
    <form action={formAction} aria-busy={pending} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <VerificationMessage state={state} />
      {state.success ? (
        <Button asChild className="h-11 w-full"><Link href="/portal" prefetch={false}>Continue to portal</Link></Button>
      ) : (
        <>
          <Button type="submit" disabled={pending} className="h-11 w-full"><ShieldCheck aria-hidden="true" />{pending ? "Verifying..." : "Verify email"}</Button>
          {state.message && <Link href="/login" className="block text-center text-sm font-medium text-primary underline underline-offset-4">Sign in to request a new verification email</Link>}
        </>
      )}
    </form>
  );
}
