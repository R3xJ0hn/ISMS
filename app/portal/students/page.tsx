import { PortalCount, PortalPageHeader } from "@/components/portal/page-header";
import { requireAdmin } from "@/lib/auth";
import { ApplicationStatus } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { StudentsTable } from "./students-table";

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
      academicLevel: true,
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
        label="Management"
        title="Manage Students"
        description="Students moved here after their admission status is marked approved."
      >
        <PortalCount count={students.length} label="approved" />
      </PortalPageHeader>

      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <StudentsTable students={students.map((application) => ({
          ...application, id: application.id.toString(), updatedAt: application.updatedAt.toISOString(),
          approvedDate: formatDate(application.updatedAt),
        }))} />
      </section>
    </main>
  );
}
