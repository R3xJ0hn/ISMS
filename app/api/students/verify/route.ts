import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type VerifyStudentRequest = {
  branchId?: string;
  studentNumber?: string;
  studentEmail?: string;
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  lastSchoolYearAttended?: string;
};

const MISSING_FIELDS_MESSAGE =
  "Complete all verification fields before checking the record.";

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeName(value: unknown) {
  return normalizeText(value).replace(/\s+/g, " ");
}

function parseBirthDateRange(value: string) {
  const start = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(start.getTime())) {
    return null;
  }

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  return { start, end };
}

function formatDisplayName(student: {
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

export async function POST(request: Request) {
  let body: VerifyStudentRequest;

  try {
    body = (await request.json()) as VerifyStudentRequest;
  } catch {
    return NextResponse.json(
      {
        verified: false,
        message: "Invalid request body.",
      },
      { status: 400 }
    );
  }

  const studentNumber = normalizeText(body.studentNumber);
  const studentEmail = normalizeText(body.studentEmail);
  const firstName = normalizeName(body.firstName);
  const lastName = normalizeName(body.lastName);
  const birthDate = normalizeText(body.birthDate);
  const lastSchoolYearAttended = normalizeText(body.lastSchoolYearAttended);

  if (
    !studentNumber ||
    !studentEmail ||
    !firstName ||
    !lastName ||
    !birthDate ||
    !lastSchoolYearAttended
  ) {
    return NextResponse.json(
      {
        verified: false,
        message: MISSING_FIELDS_MESSAGE,
      },
      { status: 400 }
    );
  }

  const birthDateRange = parseBirthDateRange(birthDate);

  if (!birthDateRange) {
    return NextResponse.json(
      {
        verified: false,
        message: "Enter a valid birth date.",
      },
      { status: 400 }
    );
  }

  try {
    const student = await prisma.student.findFirst({
      where: {
        studentNumber,
        email: {
          equals: studentEmail,
          mode: "insensitive",
        },
        firstName: {
          equals: firstName,
          mode: "insensitive",
        },
        lastName: {
          equals: lastName,
          mode: "insensitive",
        },
        birthDate: {
          gte: birthDateRange.start,
          lt: birthDateRange.end,
        },
      },
      select: {
        id: true,
        firstName: true,
        middleName: true,
        lastName: true,
        suffix: true,
        enrollments: {
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
      },
    });

    if (!student) {
      return NextResponse.json(
        {
          verified: false,
          message: "No matching student record was found.",
        },
        { status: 404 }
      );
    }

    const latestEnrollment = student.enrollments[0];

    if (!latestEnrollment) {
      return NextResponse.json(
        {
          verified: false,
          message:
            "The student record exists, but no enrollment history is available for verification.",
        },
        { status: 404 }
      );
    }

    if (latestEnrollment.schoolYear.name !== lastSchoolYearAttended) {
      return NextResponse.json(
        {
          verified: false,
          message:
            "The latest school year attended does not match our records.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      verified: true,
      student: {
        id: student.id.toString(),
        displayName: formatDisplayName(student),
        latestEnrollment: {
          schoolYear: latestEnrollment.schoolYear.name,
          branch: latestEnrollment.branch.title,
          program: latestEnrollment.program.label,
          yearLevel: latestEnrollment.academicLevels.label,
          section:
            latestEnrollment.section?.sectionName ??
            latestEnrollment.section?.sectionCode ??
            null,
        },
      },
    });
  } catch (error) {
    console.error("Failed to verify student record:", error);

    return NextResponse.json(
      {
        verified: false,
        message: "Failed to verify the student record.",
      },
      { status: 500 }
    );
  }
}
