import type { Metadata } from "next";
import { UnavailableLink } from "@/components/auth/unavailable-link";

import { getStudentUpdatePasswordRecord } from "@/lib/admission/student-password-reset";

import SetStudentPasswordForm from "./set-student-password-form";

export const metadata: Metadata = {
  title: "Set Portal Password | ISMS Application",
  description: "Create a portal password after updating student information.",
};

type AdmissionUpdatePasswordPageProps = {
  searchParams: Promise<{
    token?: string;
  }>;
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
            <UnavailableLink kind="password" />
          )}
        </div>
      </section>
    </>
  );
}
