import Link from "next/link";
import Image from "next/image";
import { Pencil } from "lucide-react";
import { notFound } from "next/navigation";

import { AdmissionReviewDetails } from "@/app/(public)/admission/components/review-step";
import { PortalFormPage } from "@/components/portal/page-header";
import { Button } from "@/components/ui/button";
import { getManagedStudentApplication } from "@/lib/admission/admin";
import { getStudentProfileImage } from "@/lib/admission/student-profile-image";
import { serializeAdmittedStudent } from "@/lib/admission/records";
import { formatStudentName } from "@/lib/utils";

export default async function StudentDetailsPage({ params }: { params: Promise<{ applicationId: string }> }) {
  const application = await getManagedStudentApplication((await params).applicationId);
  if (!application) notFound();
  const userImage = await getStudentProfileImage(application.student);

  return (
    <PortalFormPage
      label="Manage Students" title={formatStudentName(application.student)}
      description={`Student number: ${application.student.studentNumber ?? "Pending"}`}
      backHref="/portal/students" backLabel="Back to students"
      headerActions={
        <Button asChild className="w-fit">
          <Link href={`/portal/students/${application.id.toString()}/edit`}><Pencil aria-hidden="true" />Edit student</Link>
        </Button>
      }
    >
      {userImage ? <div className="flex items-center gap-4 rounded-lg border border-border bg-card p-5">
        <Image src={userImage} alt={`${formatStudentName(application.student)}'s photo`} width={80} height={80} unoptimized className="size-20 rounded-full border border-border object-cover" />
        <p className="text-sm font-medium text-foreground">Student photo</p>
      </div> : null}
      <AdmissionReviewDetails form={serializeAdmittedStudent(application).reviewForm} showConsent={false} showHeading={false} recordLabel="Student record" className="max-h-none" />
    </PortalFormPage>
  );
}
