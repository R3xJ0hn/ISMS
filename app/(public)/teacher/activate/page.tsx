import type { Metadata } from "next";
import { MailCheck } from "lucide-react";
import { getTeacherActivationRecord } from "@/lib/teachers/activation";
import { TeacherActivationForm } from "./teacher-activation-form";

export const metadata: Metadata = {
  title: "Activate Teacher Account | MyDCSAePortal",
  description: "Verify your email and choose a password for your teacher account.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function TeacherActivationPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await searchParams;
  const activationToken = typeof token === "string" && token.length <= 4096 ? token : "";
  const teacher = activationToken ? await getTeacherActivationRecord(activationToken) : null;

  return (
    <section className="bg-gray-50 px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto w-full max-w-xl rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"><MailCheck className="size-6" aria-hidden="true" /></div>
        <p className="text-sm font-semibold text-primary">Teacher account setup</p>
        <TeacherActivationForm key={activationToken} token={activationToken} record={teacher} />
      </div>
    </section>
  );
}
