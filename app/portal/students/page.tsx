import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth";
import { ApplicationStatus, UserRole } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

function formatStudentName(student: {
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
}) {
  return [
    student.firstName,
    student.middleName,
    student.lastName,
    student.suffix,
  ]
    .filter(Boolean)
    .join(" ");
}

function formatDate(date: Date | null) {
  if (!date) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function optionalValue(value: string | null | undefined) {
  return value || "Pending";
}

export default async function StudentsPage() {
  const session = await getCurrentSession();

  if (
    !session ||
    (session.role !== UserRole.admin && session.role !== UserRole.superAdmin)
  ) {
    redirect("/portal");
  }

  const students = await prisma.admissionApplication.findMany({
    where: {
      applicationStatus: ApplicationStatus.approved,
    },
    orderBy: [
      {
        updatedAt: "desc",
      },
      {
        submittedAt: "desc",
      },
    ],
    select: {
      id: true,
      applicantType: true,
      updatedAt: true,
      branch: {
        select: {
          title: true,
        },
      },
      academicLevels: {
        select: {
          label: true,
        },
      },
      program: {
        select: {
          label: true,
        },
      },
      student: {
        select: {
          email: true,
          firstName: true,
          lastName: true,
          middleName: true,
          phone: true,
          studentNumber: true,
          suffix: true,
        },
      },
    },
  });

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <section className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">Students</p>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal text-foreground">
              Approved Students
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Students moved here after their admission status is marked
              approved.
            </p>
          </div>
          <div className="w-fit rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">
              {students.length}
            </span>{" "}
            approved
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        {students.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-225 border-collapse text-left text-sm">
              <thead className="border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Student</th>
                  <th className="px-4 py-3 font-semibold">Student No.</th>
                  <th className="px-4 py-3 font-semibold">Program</th>
                  <th className="px-4 py-3 font-semibold">Branch</th>
                  <th className="px-4 py-3 font-semibold">Contact</th>
                  <th className="px-4 py-3 font-semibold">Approved</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {students.map((application) => (
                  <tr key={application.id.toString()} className="hover:bg-muted/30">
                    <td className="px-4 py-4 align-top">
                      <div className="font-medium text-foreground">
                        {formatStudentName(application.student)}
                      </div>
                      <div className="mt-1 text-xs capitalize text-muted-foreground">
                        {application.applicantType} applicant
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top text-muted-foreground">
                      {application.student.studentNumber ?? "Pending"}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="font-medium text-foreground">
                        {application.program.label}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {application.academicLevels.label}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top text-muted-foreground">
                      {application.branch.title}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="text-muted-foreground">
                        {optionalValue(application.student.phone)}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {application.student.email}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top text-muted-foreground">
                      {formatDate(application.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-14 text-center">
            <h2 className="text-base font-semibold text-foreground">
              No approved students yet
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Approved admission applications will appear here.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
