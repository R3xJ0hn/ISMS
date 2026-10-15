import type { Metadata } from "next";
import { KeyRound } from "lucide-react";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = {
  title: "Forgot Password | MyDCSAePortal",
  description: "Request a password reset email for your portal account.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function ForgotPasswordPage() {
  return (
    <section className="bg-gray-50 px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto w-full max-w-xl rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"><KeyRound className="size-6" aria-hidden="true" /></div>
        <p className="text-sm font-semibold text-primary">Account recovery</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-950">Forgot your password?</h1>
        <p className="mb-6 mt-3 text-sm leading-6 text-gray-600">Enter your account email or the email saved in your Teacher employee record. We will email instructions to set or reset your password. Links expire after 30 minutes.</p>
        <ForgotPasswordForm />
      </div>
    </section>
  );
}
