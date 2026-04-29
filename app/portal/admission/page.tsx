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

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function dateInputValue(date: Date | null) {
  return date ? formatDateInput(date) : "";
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
      where: selectedBranchId
        ? {
            branchId: selectedBranchId,
          }
        : undefined,
      orderBy: [
        {
          submittedAt: "desc",
        },
        {
          createdAt: "desc",
        },
      ],
      include: {
        academicLevels: {
          select: {
            label: true,
            slug: true,
          },
        },
        branch: {
          select: {
            slug: true,
            title: true,
          },
        },
        program: {
          select: {
            code: true,
            label: true,
            programType: true,
          },
        },
        lastSchool: {
          select: {
            schoolName: true,
            schoolId: true,
            shortName: true,
            schoolType: true,
            address: {
              select: {
                houseNumber: true,
                subdivision: true,
                street: true,
                barangay: true,
                city: true,
                province: true,
                postalCode: true,
              },
            },
          },
        },
        student: {
          select: {
            email: true,
            birthDate: true,
            id: true,
            firstName: true,
            lastName: true,
            middleName: true,
            phone: true,
            gender: true,
            civilStatus: true,
            citizenship: true,
            birthplace: true,
            religion: true,
            facebookAccount: true,
            studentNumber: true,
            suffix: true,
            address: {
              select: {
                houseNumber: true,
                subdivision: true,
                street: true,
                barangay: true,
                city: true,
                province: true,
                postalCode: true,
              },
            },
            guardians: {
              orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
              take: 1,
              select: {
                relationship: true,
                guardian: {
                  select: {
                    firstName: true,
                    lastName: true,
                    middleName: true,
                    suffix: true,
                    contactNumber: true,
                    occupation: true,
                  },
                },
              },
            },
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
  const applicationStatuses = Object.values(ApplicationStatus);

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
                        student={(() => {
                          const guardianLink = application.student.guardians[0];
                          const guardian = guardianLink?.guardian;
                          const address = application.student.address;
                          const lastSchool = application.lastSchool;
                          const lastSchoolAddress = lastSchool?.address;
                          const studentNumber =
                            application.student.studentNumber ?? "";
                          const birthDate = formatDateInput(
                            application.student.birthDate
                          );
                          const graduationDate = dateInputValue(
                            application.LSGraduationDate
                          );
                          const reviewForm = {
                            applicant_type: application.applicantType,
                            branch_id: application.branchId.toString(),
                            branch_code: application.branch.slug,
                            branch_title: application.branch.title,
                            program_type: application.program.programType,
                            program_code: application.program.code,
                            program_label: application.program.label,
                            academic_level_label:
                              application.academicLevels.label,
                            student_first_name: application.student.firstName,
                            student_last_name: application.student.lastName,
                            student_middle_name: optionalValue(
                              application.student.middleName
                            ),
                            student_suffix: optionalValue(
                              application.student.suffix
                            ),
                            student_birth_date: birthDate,
                            student_gender: optionalValue(
                              application.student.gender
                            ),
                            student_civil_status:
                              optionalValue(application.student.civilStatus),
                            student_citizenship:
                              optionalValue(application.student.citizenship),
                            student_birthplace: optionalValue(
                              application.student.birthplace
                            ),
                            student_religion: optionalValue(
                              application.student.religion
                            ),
                            contact_email: application.student.email,
                            contact_phone: optionalValue(
                              application.student.phone
                            ),
                            contact_facebook: optionalValue(
                              application.student.facebookAccount
                            ),
                            address_house_number: optionalValue(
                              address?.houseNumber
                            ),
                            address_subdivision: optionalValue(
                              address?.subdivision
                            ),
                            address_street: optionalValue(address?.street),
                            address_barangay: optionalValue(address?.barangay),
                            address_city: optionalValue(address?.city),
                            address_province: optionalValue(address?.province),
                            address_postal_code: optionalValue(
                              address?.postalCode
                            ),
                            last_school_name: optionalValue(
                              lastSchool?.schoolName
                            ),
                            last_school_id: optionalValue(lastSchool?.schoolId),
                            last_school_short_name: optionalValue(
                              lastSchool?.shortName
                            ),
                            last_school_type: optionalValue(
                              lastSchool?.schoolType
                            ),
                            last_school_house_number: optionalValue(
                              lastSchoolAddress?.houseNumber
                            ),
                            last_school_subdivision: optionalValue(
                              lastSchoolAddress?.subdivision
                            ),
                            last_school_street: optionalValue(
                              lastSchoolAddress?.street
                            ),
                            last_school_barangay: optionalValue(
                              lastSchoolAddress?.barangay
                            ),
                            last_school_city: optionalValue(
                              lastSchoolAddress?.city
                            ),
                            last_school_province: optionalValue(
                              lastSchoolAddress?.province
                            ),
                            last_school_postal_code: optionalValue(
                              lastSchoolAddress?.postalCode
                            ),
                            last_school_year: optionalValue(
                              application.LSSchoolYearEnd
                            ),
                            last_school_graduation_date: graduationDate,
                            last_school_year_level: optionalValue(
                              application.LSAttainedLevelText
                            ),
                            guardian_last_name: optionalValue(
                              guardian?.lastName
                            ),
                            guardian_first_name: optionalValue(
                              guardian?.firstName
                            ),
                            guardian_middle_name: optionalValue(
                              guardian?.middleName
                            ),
                            guardian_suffix: optionalValue(guardian?.suffix),
                            guardian_relationship: optionalValue(
                              guardianLink?.relationship
                            ),
                            guardian_contact_number: optionalValue(
                              guardian?.contactNumber
                            ),
                            guardian_occupation: optionalValue(
                              guardian?.occupation
                            ),
                            current_student_record_id: "",
                            current_student_verified_name: "",
                            current_student_verified_school_year: "",
                            current_student_verified_program: "",
                            current_student_verified_branch: "",
                          };

                          return {
                            applicationId: application.id.toString(),
                            studentId: application.student.id.toString(),
                            studentNumber,
                            firstName: application.student.firstName,
                            lastName: application.student.lastName,
                            middleName: optionalValue(
                              application.student.middleName
                            ),
                            suffix: optionalValue(application.student.suffix),
                            birthDate,
                            gender: optionalValue(application.student.gender),
                            civilStatus: optionalValue(
                              application.student.civilStatus
                            ),
                            citizenship: optionalValue(
                              application.student.citizenship
                            ),
                            birthplace: optionalValue(
                              application.student.birthplace
                            ),
                            religion: optionalValue(
                              application.student.religion
                            ),
                            email: application.student.email,
                            phone: optionalValue(application.student.phone),
                            facebookAccount: optionalValue(
                              application.student.facebookAccount
                            ),
                            addressHouseNumber: optionalValue(
                              address?.houseNumber
                            ),
                            addressSubdivision: optionalValue(
                              address?.subdivision
                            ),
                            addressStreet: optionalValue(address?.street),
                            addressBarangay: optionalValue(address?.barangay),
                            addressCity: optionalValue(address?.city),
                            addressProvince: optionalValue(address?.province),
                            addressPostalCode: optionalValue(
                              address?.postalCode
                            ),
                            guardianFirstName: optionalValue(
                              guardian?.firstName
                            ),
                            guardianLastName: optionalValue(guardian?.lastName),
                            guardianMiddleName: optionalValue(
                              guardian?.middleName
                            ),
                            guardianSuffix: optionalValue(guardian?.suffix),
                            guardianRelationship: optionalValue(
                              guardianLink?.relationship
                            ),
                            guardianContactNumber: optionalValue(
                              guardian?.contactNumber
                            ),
                            guardianOccupation: optionalValue(
                              guardian?.occupation
                            ),
                            lastSchoolName: optionalValue(
                              lastSchool?.schoolName
                            ),
                            lastSchoolId: optionalValue(lastSchool?.schoolId),
                            lastSchoolShortName: optionalValue(
                              lastSchool?.shortName
                            ),
                            lastSchoolType: optionalValue(
                              lastSchool?.schoolType
                            ),
                            lastSchoolHouseNumber: optionalValue(
                              lastSchoolAddress?.houseNumber
                            ),
                            lastSchoolSubdivision: optionalValue(
                              lastSchoolAddress?.subdivision
                            ),
                            lastSchoolStreet: optionalValue(
                              lastSchoolAddress?.street
                            ),
                            lastSchoolBarangay: optionalValue(
                              lastSchoolAddress?.barangay
                            ),
                            lastSchoolCity: optionalValue(
                              lastSchoolAddress?.city
                            ),
                            lastSchoolProvince: optionalValue(
                              lastSchoolAddress?.province
                            ),
                            lastSchoolPostalCode: optionalValue(
                              lastSchoolAddress?.postalCode
                            ),
                            lastSchoolYear: optionalValue(
                              application.LSSchoolYearEnd
                            ),
                            lastSchoolGraduationDate: graduationDate,
                            lastSchoolYearLevel: optionalValue(
                              application.LSAttainedLevelText
                            ),
                            reviewForm,
                          };
                        })()}
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
