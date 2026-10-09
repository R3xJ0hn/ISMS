import { prisma } from "../prisma";
export async function findStudentForAdmissionVerification({
  branchId,
  studentNumber,
  studentEmail,
  birthDate,
}: {
  branchId: bigint;
  studentNumber: string;
  studentEmail: string;
  birthDate: Date;
}) {
  return prisma.student.findFirst({
    where: {
      studentNumber,
      email: {
        equals: studentEmail,
        mode: "insensitive",
      },
      birthDate,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      middleName: true,
      lastName: true,
      suffix: true,
      enrollments: {
        where: {
          branchId,
        },
        orderBy: [{ schoolYearId: "desc" }, { enrolledAt: "desc" }],
        take: 1,
        select: {
          schoolYear: {
            select: {
              name: true,
            },
          },
          branch: {
            select: {
              id: true,
              title: true,
            },
          },
          program: {
            select: {
              label: true,
            },
          },
          academicLevels: {
            select: {
              label: true,
            },
          },
          section: {
            select: {
              sectionCode: true,
              sectionName: true,
            },
          },
        },
      },
      applications: {
        where: {
          branchId,
        },
        orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: {
          branch: {
            select: {
              title: true,
            },
          },
          program: {
            select: {
              label: true,
            },
          },
          academicLevels: {
            select: {
              label: true,
            },
          },
        },
      },
    },
  });
}
