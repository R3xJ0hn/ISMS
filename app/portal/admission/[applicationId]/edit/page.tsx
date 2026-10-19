import { parseId } from "@/lib/utils";
import { notFound } from "next/navigation";

import { EditAdmittedStudentForm } from "@/app/portal/admission/admitted-student-form";
import { admittedStudentInclude, serializeAdmittedStudent } from "@/lib/admission/records";
import { requireAdmin } from "@/lib/auth";

import { getPortalAdmissionOptions } from "@/lib/portal/admission-options";
import { prisma } from "@/lib/prisma";
import { getStudentProfileImage } from "@/lib/admission/student-profile-image";
import { getAdmissionLastSchools } from "@/lib/admission/last-school-catalog";

type EditAdmittedStudentPageProps = {
  params: Promise<{ applicationId: string }>;
};

export default async function EditAdmittedStudentPage({ params }: EditAdmittedStudentPageProps) {
  await requireAdmin();

  const parsedApplicationId = parseId((await params).applicationId);
  if (!parsedApplicationId) notFound();

  const [application, options] = await Promise.all([
    prisma.admissionApplication.findFirst({
      where: { id: parsedApplicationId },
      include: admittedStudentInclude,
    }),
    getPortalAdmissionOptions(true),
  ]);

  if (!application) notFound();
  const lastSchools = await getAdmissionLastSchools();
  const student = { ...serializeAdmittedStudent(application), userImage: await getStudentProfileImage(application.student) };

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <section>
        <p className="text-sm font-medium text-muted-foreground">Admission</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">Edit Admitted Student</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Update student, address, guardian, and previous school information.
        </p>
      </section>
      <EditAdmittedStudentForm student={student} options={options} allowIncomplete
        allowApproval={["updated", "submitted", "reviewing", "rejected"].includes(application.applicationStatus)}
        currentSchoolVerified={application.lastSchool?.verificationStatus === "verified"}
        lastSchools={lastSchools.schools} lastSchoolsError={lastSchools.error} />
    </main>
  );
}
