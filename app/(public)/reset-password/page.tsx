import type { Metadata } from "next";
import { KeyRound } from "lucide-react";
import { getPasswordResetRecord } from "@/lib/auth/password-reset";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  title: "Reset Password | MyDCSAePortal",
  description: "Choose a new password for your portal account.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await searchParams;
  const resetToken = typeof token === "string" && token.length <= 4096 ? token : "";
  const record = resetToken ? await getPasswordResetRecord(resetToken) : null;

  return (
    <section className="bg-gray-50 px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto w-full max-w-xl rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"><KeyRound className="size-6" aria-hidden="true" /></div>
        <p className="text-sm font-semibold text-primary">Account recovery</p>
        <ResetPasswordForm key={resetToken} token={resetToken} record={record} />
      </div>
    </section>
  );
}
