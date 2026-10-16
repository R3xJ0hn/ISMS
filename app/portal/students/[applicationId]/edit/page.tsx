import { notFound } from "next/navigation";

import { EditAdmittedStudentForm } from "@/app/portal/admission/admitted-student-form";
import { editManagedStudentAction } from "@/app/portal/students/actions";
import { PortalFormPage } from "@/components/portal/page-header";
import { getManagedStudentApplication } from "@/lib/admission/admin";
import { getStudentProfileImage } from "@/lib/admission/student-profile-image";
import { serializeAdmittedStudent } from "@/lib/admission/records";
import { getPortalAdmissionOptions } from "@/lib/portal/admission-options";

export default async function EditStudentPage({ params }: { params: Promise<{ applicationId: string }> }) {
  const application = await getManagedStudentApplication((await params).applicationId);
  if (!application) notFound();
  const options = await getPortalAdmissionOptions(true);
  const student = { ...serializeAdmittedStudent(application), userImage: await getStudentProfileImage(application.student) };

  return (
    <PortalFormPage
      label="Manage Students" title="Edit Student"
      description="Update the student's personal, program, address, guardian, and previous school details."
      backHref="/portal/students" backLabel="Back to students"
    >
      <EditAdmittedStudentForm
        student={student} options={options}
        returnTo="/portal/students" action={editManagedStudentAction}
      />
    </PortalFormPage>
  );
}
