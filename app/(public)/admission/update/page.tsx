import type { Metadata } from "next";

import Footer from "@/components/public/footer";
import { getStudentUpdateRecord } from "@/lib/admission/student-update";
import type { AdmissionUpdatePageProps } from "@/lib/types";

import UpdateStudentForm from "./update-student-form";

export const metadata: Metadata = {
  title: "Update Student Information | ISMS Application",
  description: "Secure link for updating an existing student record.",
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
            <div className="rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-red-700">
                Link unavailable
              </p>
              <h1 className="mt-2 text-2xl font-bold text-gray-950">
                This update link is invalid or has expired.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
                Return to the admission page and verify your current student
                record again to request a new email link.
              </p>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </>
  );
}
