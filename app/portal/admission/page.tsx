import { redirect } from "next/navigation";

import { AddAdmittedStudentModal } from "@/app/portal/admission/add-admitted-student-modal";
import { AdmittedStudentActions } from "@/app/portal/admission/admitted-student-actions";
import { AdmissionBranchFilter } from "@/app/portal/admission/admission-branch-filter";
import { ApplicationStatusSelect } from "@/app/portal/admission/application-status-select";
import { BulkAdmitStudentsModal } from "@/app/portal/admission/bulk-admit-students-modal";
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
  return value ?? "";
}

function formatStatusLabel(status: ApplicationStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function parseBranchId(value: string | string[] | undefined) {
  const branchId = Array.isArray(value) ? value[0] : value;

  if (!branchId || !/^\d+$/.test(branchId)) {
    return null;
  }

  return BigInt(branchId);
}

type AdmissionPageProps = {
  searchParams?: Promise<{
    branchId?: string | string[];
  }>;
};

export default async function AdmissionPage({
  searchParams,
}: AdmissionPageProps) {
  const session = await getCurrentSession();

  if (
    !session ||
    (session.role !== UserRole.admin && session.role !== UserRole.superAdmin)
  ) {
    redirect("/portal");
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const selectedBranchId = parseBranchId(resolvedSearchParams.branchId);

  const [admittedStudents, branches, programs, academicLevels] = await Promise.all([
    prisma.admissionApplication.findMany({
      where: {
        applicationStatus: {
          not: ApplicationStatus.approved,
        },
        ...(selectedBranchId ? { branchId: selectedBranchId } : {}),
      },
      orderBy: [
        {
          submittedAt: "desc",
        },
        {
          createdAt: "desc",
        },
      ],
      select: {
        id: true,
        applicantType: true,
        applicationStatus: true,
        submittedAt: true,
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
    }),
    prisma.branch.findMany({
      orderBy: {
        title: "asc",
      },
      select: {
        id: true,
        title: true,
      },
    }),
    prisma.program.findMany({
      orderBy: {
        code: "asc",
      },
      select: {
        id: true,
        code: true,
        label: true,
        programType: true,
      },
    }),
    prisma.academicLevels.findMany({
      orderBy: {
        id: "asc",
      },
      select: {
        id: true,
        label: true,
      },
    }),
  ]);

  const addStudentOptions = {
    branches: branches.map((branch) => ({
      id: branch.id.toString(),
      title: branch.title,
    })),
    programs: programs.map((program) => ({
      id: program.id.toString(),
      code: program.code,
      label: program.label,
      programType: program.programType,
    })),
    academicLevels: academicLevels.map((level) => ({
      id: level.id.toString(),
      label: level.label,
    })),
  };
  const branchFilterOptions = branches.map((branch) => ({
    id: branch.id.toString(),
    title: branch.title,
  }));
  const applicationStatuses = [
    ApplicationStatus.reviewing,
    ApplicationStatus.approved,
    ApplicationStatus.rejected,
  ];

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <section className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">Admission</p>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal text-foreground">
              Admitted Students
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Admission applications ready for review and enrollment processing.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-fit rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">
                {admittedStudents.length}
              </span>{" "}
              applications
            </div>
            <BulkAdmitStudentsModal options={addStudentOptions} />
            <AddAdmittedStudentModal options={addStudentOptions} />
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-4">
          <AdmissionBranchFilter
            branches={branchFilterOptions}
            selectedBranchId={selectedBranchId?.toString() ?? ""}
          />
        </div>
        {admittedStudents.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-225 border-collapse text-left text-sm">
              <thead className="border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Student</th>
                  <th className="px-4 py-3 font-semibold">Student No.</th>
                  <th className="px-4 py-3 font-semibold">Program</th>
                  <th className="px-4 py-3 font-semibold">Contact</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Submitted</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {admittedStudents.map((application) => (
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
                    <td className="px-4 py-4 align-top">
                      <div className="text-muted-foreground">
                        {optionalValue(application.student.phone) || "Pending"}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {application.student.email}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      {application.applicationStatus === ApplicationStatus.draft ? (
                        <span className="inline-flex rounded-md border border-border bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                          {formatStatusLabel(application.applicationStatus)}
                        </span>
                      ) : (
                        <ApplicationStatusSelect
                          applicationId={application.id.toString()}
                          status={application.applicationStatus}
                          statuses={applicationStatuses}
                        />
                      )}
                    </td>
                    <td className="px-4 py-4 align-top text-muted-foreground">
                      {formatDate(application.submittedAt)}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <AdmittedStudentActions
                        student={{
                          applicationId: application.id.toString(),
                          firstName: application.student.firstName,
                          lastName: application.student.lastName,
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-14 text-center">
            <h2 className="text-base font-semibold text-foreground">
              No admission applications yet
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Admission applications will appear here.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
