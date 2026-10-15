import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MailCheck } from "lucide-react";
import { logoutAction } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { getCurrentSession, requireAuthenticatedSession } from "@/lib/auth";
import { getEmailVerificationRecord } from "@/lib/auth/email-verification";
import { ConfirmationForm, RequestVerificationForm } from "./verification-forms";

export const metadata: Metadata = {
  title: "Verify Email | MyDCSAePortal",
  description: "Verify your email address to access your portal account.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

function VerificationCard({ children }: { children: ReactNode }) {
  return (
    <section className="bg-gray-50 px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto w-full max-w-xl rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"><MailCheck className="size-6" aria-hidden="true" /></div>
        <p className="text-sm font-semibold text-primary">Account verification</p>
        {children}
      </div>
    </section>
  );
}

function SignOutForm() {
  return (
    <form action={logoutAction} className="mt-6 border-t border-gray-200 pt-5">
      <Button type="submit" variant="outline" className="w-full">Sign out</Button>
    </form>
  );
}

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;

  if (token === undefined) {
    const session = await requireAuthenticatedSession();
    if (session.emailVerified) redirect("/portal");

    return (
      <VerificationCard>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-950">Verify your email to continue</h1>
        <p className="mt-3 text-sm leading-6 text-gray-600">Confirm your email address before accessing the portal. We&apos;ll send a verification link to:</p>
        <p className="mb-6 mt-2 break-all text-base font-semibold text-gray-950">{session.email}</p>
        <RequestVerificationForm />
        <p className="mt-6 text-sm leading-6 text-gray-600">Signed in to the wrong account? Sign out and use the correct email address.</p>
        <SignOutForm />
      </VerificationCard>
    );
  }

  const record = typeof token === "string" && token ? await getEmailVerificationRecord(token) : null;
  const session = await getCurrentSession();

  return (
    <VerificationCard>
      {record ? (
        <>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-950">Confirm your email</h1>
          <p className="mt-3 text-sm leading-6 text-gray-600">Select Verify email to confirm this address for your portal account:</p>
          <p className="mb-6 mt-2 break-all text-base font-semibold text-gray-950">{record.email}</p>
          <ConfirmationForm token={token} />
        </>
      ) : (
        <>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-950">This verification link is unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-gray-600">The link has expired, was already used, or is no longer valid. Sign in to request a new verification email.</p>
          <Button asChild className="mt-6 h-11 w-full"><Link href="/login">Sign in</Link></Button>
        </>
      )}
      {session && <SignOutForm />}
    </VerificationCard>
  );
}
