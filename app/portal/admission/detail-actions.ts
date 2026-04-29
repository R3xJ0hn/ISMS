"use server";

import { serializeAdmittedStudent } from "@/app/portal/admission/serialize-admitted-student";
import { getCurrentSession } from "@/lib/auth";
import { UserRole } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export async function getAdmittedStudentDetails(applicationId: string) {
  const session = await getCurrentSession();

  if (
    !session ||
    (session.role !== UserRole.admin && session.role !== UserRole.superAdmin)
  ) {
    return null;
  }

  if (!/^\d+$/.test(applicationId)) {
    return null;
  }

  const application = await prisma.admissionApplication.findUnique({
    where: {
      id: BigInt(applicationId),
    },
    include: {
      academicLevels: {
        select: {
          label: true,
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
  });

  return application ? serializeAdmittedStudent(application) : null;
}
