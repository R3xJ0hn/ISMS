import { parseRecordId, formatDate } from "@/lib/utils";
import { AddAdmittedStudentModal, BulkAdmitStudentsModal } from "@/app/portal/admission/admitted-student-form";
import { AdmissionsTable } from "./admissions-table";
import { PortalCount, PortalPageHeader } from "@/components/portal/page-header";
import { requireAdmin } from "@/lib/auth";
import { getAdmissionLastSchools } from "@/lib/admission/last-school-catalog";

import { ApplicationStatus } from "@/lib/generated/prisma/enums";
import { getPortalAdmissionOptions } from "@/lib/portal/admission-options";
import { prisma } from "@/lib/prisma";

type AdmissionPageProps = {
  searchParams?: Promise<{ branchId?: string | string[] }>;
};

export default async function AdmissionPage({ searchParams }: AdmissionPageProps) {
  await requireAdmin();

  const branchId = (await searchParams)?.branchId;
  const selectedBranchId = parseRecordId((Array.isArray(branchId) ? branchId[0] : branchId) ?? "");
  const [admittedStudents, options, lastSchools] = await Promise.all([
    prisma.admissionApplication.findMany({
      where: {
        applicationStatus: { not: ApplicationStatus.approved },
        ...(selectedBranchId ? { branchId: selectedBranchId } : {}),
      },
      orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        applicantType: true,
        applicationStatus: true,
        submittedAt: true,
        academicLevel: true,
        program: { select: { label: true } },
        student: {
          select: {
            email: true, firstName: true, lastName: true, middleName: true,
            phone: true, studentNumber: true, suffix: true,
          },
        },
      },
    }),
    getPortalAdmissionOptions(),
    getAdmissionLastSchools(),
  ]);

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <PortalPageHeader
        label="Admission"
        title="Admitted Students"
        description="Admission applications ready for review and enrollment processing."
      >
        <div className="flex flex-wrap items-center gap-2">
          <PortalCount count={admittedStudents.length} label="applications" />
          <BulkAdmitStudentsModal options={options} />
          <AddAdmittedStudentModal options={options} lastSchools={lastSchools.schools} lastSchoolsError={lastSchools.error} />
        </div>
      </PortalPageHeader>

      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <AdmissionsTable
          applications={admittedStudents.map((application) => ({
            ...application,
            id: application.id.toString(),
            submittedAt: application.submittedAt?.toISOString() ?? null,
            submittedDate: formatDate(application.submittedAt),
          }))}
          branches={options.branches}
          selectedBranchId={selectedBranchId?.toString() ?? ""}
        />
      </section>
    </main>
  );
}
