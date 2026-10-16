import Link from "next/link";
import { Plus, UserPlus } from "lucide-react";
import { PortalCount, PortalPageHeader } from "@/components/portal/page-header";
import { Button } from "@/components/ui/button";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEmployeeFullName } from "@/lib/employees/names";
import { ClassesTable } from "./classes-table";

export default async function ClassesManagementPage() {
  await requireSuperAdmin();
  const [classes, teacherCount] = await Promise.all([
    prisma.class.findMany({
      where: { teacher: { user: { role: { not: "superAdmin" } } } },
      orderBy: [{ schoolYear: "desc" }, { sectionName: "asc" }, { subjectName: "asc" }],
      select: {
        id: true, schoolYear: true, semester: true, sectionName: true, yearLevel: true,
        subjectName: true, spreadsheetUrl: true,
        teacher: { select: { employee: { select: { firstName: true, middleName: true, lastName: true, suffix: true } }, user: { select: { email: true } } } },
        branch: { select: { title: true } },
        program: { select: { code: true, label: true } },
        _count: { select: { students: true } },
      },
    }),
    prisma.teacher.count({ where: { user: { role: "teacher", emailVerified: true } } }),
  ]);

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <PortalPageHeader label="Management" title="Manage Classes" description="Assign teachers to classes and subjects. Each teacher adds their own Google Sheets link.">
        <div className="flex flex-wrap items-center gap-3">
          <PortalCount count={classes.length} label="classes" />
          <Button asChild><Link href="/portal/classes/new"><Plus aria-hidden="true" />Add class</Link></Button>
        </div>
      </PortalPageHeader>
      {teacherCount === 0 && (
        <section className="rounded-lg border border-border bg-card p-5 shadow-sm" aria-label="Add a teacher first">
          <h2 className="text-base font-semibold">Set up a teacher account to assign classes</h2>
          <p className="mt-2 text-sm text-muted-foreground">Send a Teacher employee an account setup email and assign classes after they verify their email and set a password.</p>
          <Button asChild variant="outline" className="mt-4"><Link href="/portal/teachers"><UserPlus aria-hidden="true" />Manage teachers</Link></Button>
        </section>
      )}
      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm" aria-label="Class assignments">
        <ClassesTable classes={classes.map((classRecord) => ({
          id: classRecord.id.toString(), schoolYear: classRecord.schoolYear, semester: classRecord.semester,
          sectionName: classRecord.sectionName, yearLevel: classRecord.yearLevel,
          subjectName: classRecord.subjectName, teacherEmail: classRecord.teacher.user.email,
          teacherName: getEmployeeFullName(classRecord.teacher.employee), studentCount: classRecord._count.students,
          branchTitle: classRecord.branch?.title ?? null,
          programLabel: classRecord.program ? classRecord.program.code + " — " + classRecord.program.label : null,
          spreadsheetLinked: Boolean(classRecord.spreadsheetUrl),
        }))} />
      </section>
    </main>
  );
}
