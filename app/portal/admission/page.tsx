import { AddAdmittedStudentModal, BulkAdmitStudentsModal } from "@/app/portal/admission/admitted-student-form";
import { AdmittedStudentActions } from "@/app/portal/admission/admitted-student-actions";
import { AdmissionBranchFilter, ApplicationStatusSelect } from "@/app/portal/admission/admission-controls";
import { PortalTable } from "@/components/portal/data-table";
import { PortalCount, PortalEmptyState, PortalPageHeader } from "@/components/portal/page-header";
import { studentColumns } from "@/components/portal/student-columns";
import { requireAdmin } from "@/lib/auth";
import { parseId } from "@/lib/admission/validation";
import { ApplicationStatus } from "@/lib/generated/prisma/enums";
import { getPortalAdmissionOptions } from "@/lib/portal/admission-options";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";

type AdmissionPageProps = {
  searchParams?: Promise<{ branchId?: string | string[] }>;
};

const applicationStatuses = [ApplicationStatus.reviewing, ApplicationStatus.approved, ApplicationStatus.rejected];

export default async function AdmissionPage({ searchParams }: AdmissionPageProps) {
  await requireAdmin();

  const branchId = (await searchParams)?.branchId;
  const selectedBranchId = parseId((Array.isArray(branchId) ? branchId[0] : branchId) ?? "");
  const [admittedStudents, options] = await Promise.all([
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
        academicLevels: { select: { label: true } },
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
          <AddAdmittedStudentModal options={options} />
        </div>
      </PortalPageHeader>

      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-4">
          <AdmissionBranchFilter branches={options.branches} selectedBranchId={selectedBranchId?.toString() ?? ""} />
        </div>
        {admittedStudents.length > 0 ? (
          <PortalTable<(typeof admittedStudents)[number]>
            rows={admittedStudents}
            rowKey={(application) => application.id.toString()}
            className="min-w-225 border-collapse"
            columns={[
              studentColumns.student,
              studentColumns.studentNumber,
              studentColumns.program,
              studentColumns.contact,
              {
                header: "Status",
                cell: (application) => application.applicationStatus === ApplicationStatus.draft ? (
                  <span className="inline-flex rounded-md border border-border bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                    {application.applicationStatus.charAt(0).toUpperCase() + application.applicationStatus.slice(1)}
                  </span>
                ) : (
                  <ApplicationStatusSelect applicationId={application.id.toString()} status={application.applicationStatus} statuses={applicationStatuses} />
                ),
              },
              { header: "Submitted", className: "text-muted-foreground", cell: (application) => formatDate(application.submittedAt) },
              {
                header: "Actions",
                cell: (application) => <AdmittedStudentActions student={{
                  applicationId: application.id.toString(),
                  firstName: application.student.firstName,
                  lastName: application.student.lastName,
                }} />,
              },
            ]}
          />
        ) : (
          <PortalEmptyState title="No admission applications yet" description="Admission applications will appear here." />
        )}
      </section>
    </main>
  );
}
