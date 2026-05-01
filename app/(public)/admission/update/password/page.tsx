import type { Metadata } from "next";

import Footer from "@/components/public/footer";
import { getStudentUpdatePasswordRecord } from "@/lib/admission/student-password-reset";
import type { AdmissionUpdatePasswordPageProps } from "@/lib/admission/types";

import SetStudentPasswordForm from "./set-student-password-form";

export const metadata: Metadata = {
  title: "Set Portal Password | ISMS Application",
  description: "Create a portal password after updating student information.",
};

export default async function AdmissionUpdatePasswordPage({
  searchParams,
}: AdmissionUpdatePasswordPageProps) {
  const { token = "" } = await searchParams;
  const student = token ? await getStudentUpdatePasswordRecord(token) : null;

  return (
    <>
      <section className="bg-gray-50 pb-16 pt-8">
        <div className="mx-auto max-w-xl px-4 sm:px-6 lg:px-8">
          {student ? (
            <SetStudentPasswordForm student={student} />
          ) : (
            <div className="rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-red-700">
                Link unavailable
              </p>
              <h1 className="mt-2 text-2xl font-bold text-gray-950">
                This password setup link is invalid or has expired.
              </h1>
              <p className="mt-3 text-sm leading-6 text-gray-600">
                Return to the admission page and verify your current student
                record again to request a new secure link.
              </p>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </>
  );
}
