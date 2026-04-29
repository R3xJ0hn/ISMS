import { notFound, redirect } from "next/navigation";

import {
  EditAdmittedStudentForm,
  type AdmittedStudentEditOptions,
} from "@/app/portal/admission/edit-admitted-student-form";
import { serializeAdmittedStudent } from "@/app/portal/admission/serialize-admitted-student";
import { getCurrentSession } from "@/lib/auth";
import { UserRole } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

type EditAdmittedStudentPageProps = {
  params: Promise<{
    applicationId: string;
  }>;
};

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
        academicLevels: {
          select: {
            label: true,
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
        slug: true,
      },
    }),
  ]);

  if (!application) {
    notFound();
  }

  const student = serializeAdmittedStudent(application);

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
      slug: level.slug,
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
