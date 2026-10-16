import { redirect } from "next/navigation";
import { ClipboardCheck } from "lucide-react";

import { getStudentAdmissionReview } from "@/lib/admission/student-review";
import StudentAdmissionReviewForm from "./review-form";

export default async function StudentAdmissionReviewPage() {
  const student = await getStudentAdmissionReview();
  if (!student) redirect("/portal/classroom");

  const admissionDetails = [
    ["Student number", student.studentNumber || "Not yet assigned"],
    ["Branch", student.branch],
    ["Program", student.program],
    ["Year level", student.academicLevel],
    ["Admission status", "Under review"],
  ];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:p-8">
      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
          <ClipboardCheck aria-hidden="true" className="size-4" />Under review
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Review your information</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Your admission is under review. Check your saved information and update any details that need correcting.
          You can continue to your classes after reviewing, even if nothing has changed.
        </p>
      </header>

      <section aria-labelledby="admission-details-heading" className="rounded-xl border bg-white p-5 shadow-sm sm:p-6">
        <h2 id="admission-details-heading" className="font-semibold">Admission details</h2>
        <dl className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {admissionDetails.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="mt-1 wrap-break-word text-sm font-medium">{value || "Not available"}</dd>
            </div>
          ))}
        </dl>
      </section>

      <StudentAdmissionReviewForm student={student} />
    </main>
  );
}
