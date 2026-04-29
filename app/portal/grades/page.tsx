import { redirect } from "next/navigation";
import { AlertCircle } from "lucide-react";
import type { CSSProperties } from "react";

import { GradesView } from "@/app/portal/grades/grades-view";
import { AppSidebar } from "@/components/app-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { getCurrentSession } from "@/lib/auth";
import { UserRole } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { getStudentGrades, normalizeSemester } from "@/lib/student-grades";

const portalTheme = {
  "--background": "oklch(1 0 0)",
  "--foreground": "oklch(0.145 0 0)",
  "--card": "oklch(1 0 0)",
  "--card-foreground": "oklch(0.145 0 0)",
  "--popover": "oklch(1 0 0)",
  "--popover-foreground": "oklch(0.145 0 0)",
  "--primary": "oklch(0.205 0 0)",
  "--primary-foreground": "oklch(0.985 0 0)",
  "--secondary": "oklch(0.97 0 0)",
  "--secondary-foreground": "oklch(0.205 0 0)",
  "--accent": "oklch(0.97 0 0)",
  "--accent-foreground": "oklch(0.205 0 0)",
  "--muted": "oklch(0.97 0 0)",
  "--muted-foreground": "oklch(0.556 0 0)",
  "--destructive": "oklch(0.577 0.245 27.325)",
  "--destructive-foreground": "oklch(0.985 0 0)",
  "--border": "oklch(0.922 0 0)",
  "--input": "oklch(0.922 0 0)",
  "--ring": "oklch(0.708 0 0)",
  "--chart-1": "oklch(0.646 0.222 41.116)",
  "--chart-2": "oklch(0.6 0.118 184.704)",
  "--chart-3": "oklch(0.398 0.07 227.392)",
  "--chart-4": "oklch(0.828 0.189 84.429)",
  "--chart-5": "oklch(0.769 0.188 70.08)",
  "--sidebar": "oklch(0.985 0 0)",
  "--sidebar-foreground": "oklch(0.145 0 0)",
  "--sidebar-primary": "oklch(0.205 0 0)",
  "--sidebar-primary-foreground": "oklch(0.985 0 0)",
  "--sidebar-accent": "oklch(0.97 0 0)",
  "--sidebar-accent-foreground": "oklch(0.205 0 0)",
  "--sidebar-border": "oklch(0.922 0 0)",
  "--sidebar-ring": "oklch(0.708 0 0)",
} as CSSProperties;

type PageProps = {
  searchParams?: Promise<{
    semester?: string | string[];
  }>;
};

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

export default async function StudentGradesPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  if (session.role !== UserRole.student) {
    redirect("/portal");
  }

  if (!process.env.STUDENT_GRADES_APPS_SCRIPT_URL) {
    console.error("STUDENT_GRADES_APPS_SCRIPT_URL is not configured.");
  }

  const resolvedSearchParams = await searchParams;
  const semester = normalizeSemester(resolvedSearchParams?.semester);
  const student = await prisma.student.findUnique({
    where: {
      email: session.email,
    },
    select: {
      firstName: true,
      middleName: true,
      lastName: true,
      suffix: true,
      studentNumber: true,
    },
  });

  const gradesResult = student?.studentNumber
    ? await getStudentGrades(student.studentNumber, semester)
    : {
        success: false as const,
        semester,
        message: "Your student number is not available yet.",
      };
  const displayName =
    gradesResult.success && gradesResult.studentName
      ? gradesResult.studentName
      : student
        ? formatStudentName(student)
        : "Student record";

  return (
    <SidebarProvider style={portalTheme}>
      <AppSidebar session={session} />
      <SidebarInset className="bg-background">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-background/95 transition-[width,height] ease-linear backdrop-blur-sm group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/portal">Portal</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Grades</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        <main className="flex flex-1 flex-col gap-5 p-4 md:p-6">
          <GradesView
            semester={semester}
            displayName={displayName}
            studentNumber={student?.studentNumber ?? null}
          >
            {!gradesResult.success ? (
              <section className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-foreground">
                <div className="flex gap-3">
                  <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
                  <div>
                    <h2 className="font-semibold">Grades unavailable</h2>
                    <p className="mt-1 text-muted-foreground">{gradesResult.message}</p>
                    {!process.env.STUDENT_GRADES_APPS_SCRIPT_URL ? (
                      <p className="mt-2 text-muted-foreground">
                        Grades are unavailable right now; please contact support.
                      </p>
                    ) : null}
                  </div>
                </div>
              </section>
            ) : (
              <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                <div className="border-b border-border px-4 py-3">
                  <h2 className="text-sm font-semibold text-foreground">
                    {semester === "1stSem" ? "1st Semester" : "2nd Semester"}
                  </h2>
                </div>
                {gradesResult.grades.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-240 text-left text-sm">
                      <thead className="border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Code</th>
                          <th className="px-4 py-3 font-semibold">Subject</th>
                          <th className="px-4 py-3 font-semibold">Units</th>
                          <th className="px-4 py-3 font-semibold">Instructor</th>
                          <th className="px-4 py-3 font-semibold">Prelim</th>
                          <th className="px-4 py-3 font-semibold">Midterm</th>
                          <th className="px-4 py-3 font-semibold">Prefinals</th>
                          <th className="px-4 py-3 font-semibold">Finals</th>
                          <th className="px-4 py-3 font-semibold">Ave</th>
                          <th className="px-4 py-3 font-semibold">Remarks</th>
                          <th className="px-4 py-3 font-semibold">Note</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {gradesResult.grades.map((grade, index) => (
                          <tr key={`${grade.code ?? grade.subject}-${index}`}>
                            <td className="px-4 py-3 font-medium text-foreground">
                              {grade.code ?? "-"}
                            </td>
                            <td className="px-4 py-3 text-foreground">{grade.subject}</td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {grade.units ?? "-"}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {grade.instructor ?? "-"}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {grade.prelim ?? "-"}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {grade.midterm ?? "-"}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {grade.prefinals ?? "-"}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {grade.finals ?? "-"}
                            </td>
                            <td className="px-4 py-3 font-semibold text-foreground">
                              {grade.average ?? "-"}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {grade.remarks ?? "-"}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {grade.note ?? "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <h2 className="text-sm font-semibold text-foreground">
                      No grades found
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      No grade records were returned for this semester.
                    </p>
                  </div>
                )}
              </section>
            )}
          </GradesView>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
