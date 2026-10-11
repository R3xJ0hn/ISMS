import type { Metadata } from "next";
import { UnavailableLink } from "@/components/auth/unavailable-link";

import { getStudentUpdateRecord } from "@/lib/admission/student-update";

import UpdateStudentForm from "./update-student-form";

export const metadata: Metadata = {
  title: "Update Student Information | ISMS Application",
  description: "Secure link for updating an existing student record.",
};

type AdmissionUpdatePageProps = {
  searchParams: Promise<{
    token?: string;
  }>;
};

export default async function AdmissionUpdatePage({
  searchParams,
}: AdmissionUpdatePageProps) {
  const { token = "" } = await searchParams;
  const student = token ? await getStudentUpdateRecord(token) : null;

  return (
    <>
      <section className="bg-gray-50 pb-16 pt-8">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          {student ? (
            <UpdateStudentForm student={student} />
          ) : (
            <UnavailableLink kind="update" />
          )}
        </div>
      </section>
    </>
  );
}
