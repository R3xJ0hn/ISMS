import { notFound, redirect } from "next/navigation";

import {
  EditAdmittedStudentForm,
  type AdmittedStudentEditRecord,
  type AdmittedStudentEditOptions,
} from "@/app/portal/admission/edit-admitted-student-form";
import { getCurrentSession } from "@/lib/auth";
import { UserRole } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

type EditAdmittedStudentPageProps = {
  params: Promise<{
    applicationId: string;
  }>;
};

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function dateInputValue(date: Date | null) {
  return date ? formatDateInput(date) : "";
}

function optionalValue(value: string | null | undefined) {
  return value ?? "";
}

function parseId(value: string) {
  if (!/^\d+$/.test(value)) {
    return null;
  }

  return BigInt(value);
}

export default async function EditAdmittedStudentPage({
  params,
}: EditAdmittedStudentPageProps) {
  const session = await getCurrentSession();

  if (
    !session ||
    (session.role !== UserRole.admin && session.role !== UserRole.superAdmin)
  ) {
    redirect("/portal");
  }

  const { applicationId } = await params;
  const parsedApplicationId = parseId(applicationId);

  if (!parsedApplicationId) {
    notFound();
  }

  const [application, branches, programs, academicLevels] = await Promise.all([
    prisma.admissionApplication.findFirst({
      where: {
        id: parsedApplicationId,
      },
      include: {
        student: {
          select: {
            id: true,
            studentNumber: true,
            firstName: true,
            lastName: true,
            middleName: true,
            suffix: true,
            birthDate: true,
            gender: true,
            civilStatus: true,
            citizenship: true,
            birthplace: true,
            religion: true,
            email: true,
            phone: true,
            facebookAccount: true,
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

  if (!application) {
    notFound();
  }

  const guardianLink = application.student.guardians[0];
  const guardian = guardianLink?.guardian;
  const address = application.student.address;
  const lastSchool = application.lastSchool;
  const lastSchoolAddress = lastSchool?.address;

  const student = {
    applicationId: application.id.toString(),
    studentId: application.student.id.toString(),
    applicantType: application.applicantType,
    branchId: application.branchId.toString(),
    programId: application.programId.toString(),
    academicLevelsId: application.academicLevelsId.toString(),
    studentNumber: application.student.studentNumber ?? "",
    firstName: application.student.firstName,
    lastName: application.student.lastName,
    middleName: optionalValue(application.student.middleName),
    suffix: optionalValue(application.student.suffix),
    birthDate: formatDateInput(application.student.birthDate),
    gender: optionalValue(application.student.gender),
    civilStatus: optionalValue(application.student.civilStatus),
    citizenship: optionalValue(application.student.citizenship),
    birthplace: optionalValue(application.student.birthplace),
    religion: optionalValue(application.student.religion),
    email: application.student.email,
    phone: optionalValue(application.student.phone),
    facebookAccount: optionalValue(application.student.facebookAccount),
    addressHouseNumber: optionalValue(address?.houseNumber),
    addressSubdivision: optionalValue(address?.subdivision),
    addressStreet: optionalValue(address?.street),
    addressBarangay: optionalValue(address?.barangay),
    addressCity: optionalValue(address?.city),
    addressProvince: optionalValue(address?.province),
    addressPostalCode: optionalValue(address?.postalCode),
    guardianFirstName: optionalValue(guardian?.firstName),
    guardianLastName: optionalValue(guardian?.lastName),
    guardianMiddleName: optionalValue(guardian?.middleName),
    guardianSuffix: optionalValue(guardian?.suffix),
    guardianRelationship: optionalValue(guardianLink?.relationship),
    guardianContactNumber: optionalValue(guardian?.contactNumber),
    guardianOccupation: optionalValue(guardian?.occupation),
    lastSchoolName: optionalValue(lastSchool?.schoolName),
    lastSchoolId: optionalValue(lastSchool?.schoolId),
    lastSchoolShortName: optionalValue(lastSchool?.shortName),
    lastSchoolType: optionalValue(lastSchool?.schoolType),
    lastSchoolHouseNumber: optionalValue(lastSchoolAddress?.houseNumber),
    lastSchoolSubdivision: optionalValue(lastSchoolAddress?.subdivision),
    lastSchoolStreet: optionalValue(lastSchoolAddress?.street),
    lastSchoolBarangay: optionalValue(lastSchoolAddress?.barangay),
    lastSchoolCity: optionalValue(lastSchoolAddress?.city),
    lastSchoolProvince: optionalValue(lastSchoolAddress?.province),
    lastSchoolPostalCode: optionalValue(lastSchoolAddress?.postalCode),
    lastSchoolYear: optionalValue(application.LSSchoolYearEnd),
    lastSchoolGraduationDate: dateInputValue(application.LSGraduationDate),
    lastSchoolYearLevel: optionalValue(application.LSAttainedLevelText),
  } satisfies AdmittedStudentEditRecord;

  const options = {
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
  } satisfies AdmittedStudentEditOptions;

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <section>
        <p className="text-sm font-medium text-muted-foreground">Admission</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">
          Edit Admitted Student
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Update student, address, guardian, and previous school information.
        </p>
      </section>
      <EditAdmittedStudentForm student={student} options={options} />
    </main>
  );
}
