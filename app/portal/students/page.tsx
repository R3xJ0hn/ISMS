import { PortalTable } from "@/components/portal/data-table";
import { PortalCount, PortalEmptyState, PortalPageHeader } from "@/components/portal/page-header";
import { studentColumns } from "@/components/portal/student-columns";
import { requireAdmin } from "@/lib/auth";
import { ApplicationStatus } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";

export default async function StudentsPage() {
  await requireAdmin();

  const students = await prisma.admissionApplication.findMany({
    where: { applicationStatus: ApplicationStatus.approved },
    orderBy: [{ updatedAt: "desc" }, { submittedAt: "desc" }],
    select: {
      id: true,
      applicantType: true,
      updatedAt: true,
      branch: { select: { title: true } },
      academicLevels: { select: { label: true } },
      program: { select: { label: true } },
      student: {
        select: {
          email: true, firstName: true, lastName: true, middleName: true,
          phone: true, studentNumber: true, suffix: true,
        },
      },
    },
  });

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <PortalPageHeader
        label="Students"
        title="Approved Students"
        description="Students moved here after their admission status is marked approved."
      >
        <PortalCount count={students.length} label="approved" />
      </PortalPageHeader>

      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        {students.length > 0 ? (
          <PortalTable<(typeof students)[number]>
            rows={students}
            rowKey={(application) => application.id.toString()}
            className="min-w-225 border-collapse"
            columns={[
              studentColumns.student,
              studentColumns.studentNumber,
              studentColumns.program,
              { header: "Branch", className: "text-muted-foreground", cell: (application) => application.branch.title },
              studentColumns.contact,
              { header: "Approved", className: "text-muted-foreground", cell: (application) => formatDate(application.updatedAt) },
            ]}
          />
        ) : (
          <PortalEmptyState title="No approved students yet" description="Approved admission applications will appear here." />
        )}
      </section>
    </main>
  );
}
