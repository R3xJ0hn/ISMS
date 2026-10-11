import { studentProfileFromRecord, studentUpdateSelect, type StudentUpdateQueryResult } from "@/lib/admission/records";
import { parseDateInput } from "./validation";
import { firstInvalidStudentUpdateField, normalizeStudentUpdateInput, type UpdateStudentRecordInput } from "./student-fields";
import { addressDataFromProfile, guardianDataFromProfile, lastSchoolDataFromProfile, studentDataFromProfile } from "./profile-data";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import {
  ApplicantType,
  ApplicationStatus,
} from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export { studentUpdateFields, type UpdateStudentRecordInput } from "./student-fields";

const STUDENT_UPDATE_LINK_TTL_MS = 1000 * 60 * 60;

export type StudentUpdateTokenPayload = {
  scope: "student-update";
  studentId: string;
  jti: string;
  exp: number;
};

export type StudentUpdateRecord = ReturnType<typeof mapStudentRecord>;

function getStudentUpdateLinkSecret() {
  const secret =
    process.env.STUDENT_UPDATE_LINK_SECRET ?? process.env.RESEND_API_KEY;

  if (!secret) {
    throw new Error(
      "STUDENT_UPDATE_LINK_SECRET or RESEND_API_KEY must be configured."
    );
  }

  return secret;
}

function signStudentUpdateToken(encodedPayload: string) {
  return createHmac("sha256", getStudentUpdateLinkSecret())
    .update(encodedPayload)
    .digest("base64url");
}

export function verifyStudentUpdateToken(token: string) {
  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signStudentUpdateToken(encodedPayload);
  const providedSignature = Buffer.from(signature);
  const calculatedSignature = Buffer.from(expectedSignature);

  if (
    providedSignature.length !== calculatedSignature.length ||
    !timingSafeEqual(providedSignature, calculatedSignature)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as StudentUpdateTokenPayload;

    if (
      payload.scope !== "student-update" ||
      !/^\d+$/.test(payload.studentId) ||
      typeof payload.jti !== "string" ||
      payload.exp <= Date.now()
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function normalizeAppBaseUrl(value: string) {
  const url = new URL(value.trim());
  const allowHttp = process.env.NODE_ENV === "development";

  if (url.protocol !== "https:" && !(allowHttp && url.protocol === "http:")) {
    throw new Error("APP_URL must use HTTPS outside development.");
  }

  url.search = "";
  url.hash = "";
  url.pathname = url.pathname.replace(/\/+$/, "");

  return url.toString().replace(/\/$/, "");
}

function getAppBaseUrl() {
  if (process.env.APP_URL) {
    return normalizeAppBaseUrl(process.env.APP_URL);
  }

  if (process.env.NEXT_PUBLIC_APP_URL) {
    return normalizeAppBaseUrl(process.env.NEXT_PUBLIC_APP_URL);
  }

  if (process.env.VERCEL_URL) {
    return normalizeAppBaseUrl(`https://${process.env.VERCEL_URL}`);
  }

  return normalizeAppBaseUrl("http://localhost:3000");
}

function mapStudentRecord(
  token: string,
  student: StudentUpdateQueryResult
) {
  const primaryGuardian =
    student.guardians.find((guardian) => guardian.isPrimary) ??
    student.guardians[0];
  const latestApplication = student.applications[0];
  const latestEnrollment = student.enrollments[0];

  return {
    token,
    studentId: student.id.toString(),
    ...studentProfileFromRecord(student, latestApplication, primaryGuardian),
    latestEnrollmentStatus:
      latestEnrollment?.enrollmentStatus ??
      latestApplication?.applicationStatus ??
      "",
    latestEnrollmentSchoolYear: latestEnrollment?.schoolYear.name ?? "",
    latestEnrollmentBranch:
      latestEnrollment?.branch.title ?? latestApplication?.branch.title ?? "",
    latestEnrollmentProgram:
      latestEnrollment?.program.label ?? latestApplication?.program.label ?? "",
    latestEnrollmentYearLevel:
      latestEnrollment?.academicLevels.label ??
      latestApplication?.academicLevels.label ??
      "",
    latestEnrollmentSection:
      latestEnrollment?.section?.sectionName ??
      latestEnrollment?.section?.sectionCode ??
      "",
  };
}

export async function createStudentUpdateUrl(studentId: string) {
  const expiresAt = new Date(Date.now() + STUDENT_UPDATE_LINK_TTL_MS);
  const payload: StudentUpdateTokenPayload = {
    scope: "student-update",
    studentId,
    jti: randomUUID(),
    exp: expiresAt.getTime(),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signStudentUpdateToken(encodedPayload);
  const token = `${encodedPayload}.${signature}`;

  await prisma.studentUpdateToken.create({
    data: {
      jti: payload.jti,
      studentId: BigInt(studentId),
      expiresAt,
    },
  });

  const updateUrl = new URL("/admission/update", getAppBaseUrl());
  updateUrl.searchParams.set("token", token);

  return updateUrl.toString();
}

export async function getStudentUpdateRecord(token: string) {
  const payload = verifyStudentUpdateToken(token);

  if (!payload) {
    return null;
  }

  const student = await prisma.student.findUnique({
    where: {
      id: BigInt(payload.studentId),
    },
    select: studentUpdateSelect,
  });

  if (!student) {
    return null;
  }

  return mapStudentRecord(token, student);
}

export async function updateStudentRecordFromToken(
  token: string,
  input: UpdateStudentRecordInput
) {
  const payload = verifyStudentUpdateToken(token);

  if (!payload) {
    return {
      success: false,
      message: "This update link is invalid or has expired.",
    };
  }

  const normalizedInput = normalizeStudentUpdateInput(input);
  const invalidField = firstInvalidStudentUpdateField(normalizedInput);

  if (invalidField) {
    return {
      success: false,
      message: "Complete the required fields with valid information.",
    };
  }

  const birthDate = parseDateInput(normalizedInput.birthDate);

  if (!birthDate) {
    return {
      success: false,
      message: "Enter a valid birth date.",
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const student = await tx.student.findUnique({
        where: {
          id: BigInt(payload.studentId),
        },
        select: {
          id: true,
          addressId: true,
          guardians: {
            orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
            take: 1,
            select: {
              id: true,
              guardianId: true,
            },
          },
          applications: {
            orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
            take: 1,
            select: {
              id: true,
              branchId: true,
              programId: true,
              academicLevelsId: true,
              programType: true,
              lastSchoolId: true,
              applicationStatus: true,
              submittedAt: true,
              lastSchool: {
                select: {
                  id: true,
                  addressId: true,
                },
              },
            },
          },
          enrollments: {
            orderBy: [{ schoolYearId: "desc" }, { enrolledAt: "desc" }],
            take: 1,
            select: {
              branchId: true,
              programId: true,
              academicLevelsId: true,
              program: {
                select: {
                  programType: true,
                },
              },
            },
          },
        },
      });

      if (!student) {
        throw new Error("Student record not found.");
      }

      const addressData = addressDataFromProfile(normalizedInput, "address");

      let addressId = student.addressId;

      if (addressId) {
        const addressStudentCount = await tx.student.count({
          where: {
            addressId,
          },
        });

        if (addressStudentCount > 1) {
          const address = await tx.address.create({
            data: addressData,
          });
          addressId = address.id;
        } else {
          await tx.address.update({
            where: {
              id: addressId,
            },
            data: addressData,
          });
        }
      } else {
        const address = await tx.address.create({
          data: addressData,
        });
        addressId = address.id;
      }

      const primaryGuardianLink = student.guardians[0];
      const guardianData = guardianDataFromProfile(normalizedInput);

      if (primaryGuardianLink) {
        const guardianLinkCount = await tx.studentGuardian.count({
          where: {
            guardianId: primaryGuardianLink.guardianId,
          },
        });

        const guardian =
          guardianLinkCount > 1
            ? await tx.guardian.create({
                data: {
                  ...guardianData,
                  email: null,
                  addressId: null,
                  facebookAccount: null,
                },
              })
            : await tx.guardian.update({
                where: {
                  id: primaryGuardianLink.guardianId,
                },
                data: guardianData,
              });

        await tx.studentGuardian.update({
          where: {
            id: primaryGuardianLink.id,
          },
          data: {
            guardianId: guardian.id,
            relationship: normalizedInput.guardianRelationship,
            isPrimary: true,
          },
        });
      } else {
        const guardian = await tx.guardian.create({
          data: {
            ...guardianData,
            email: null,
            addressId: null,
            facebookAccount: null,
          },
        });

        await tx.studentGuardian.create({
          data: {
            studentId: student.id,
            guardianId: guardian.id,
            relationship: normalizedInput.guardianRelationship,
            isPrimary: true,
          },
        });
      }

      const lastSchoolAddressData = addressDataFromProfile(normalizedInput, "lastSchool");

      const latestApplication = student.applications[0];
      const latestEnrollment = student.enrollments[0];
      let lastSchoolId = latestApplication?.lastSchoolId ?? null;
      let lastSchoolAddressId = latestApplication?.lastSchool?.addressId ?? null;
      const lastSchoolData = lastSchoolDataFromProfile(normalizedInput);

      if (lastSchoolId) {
        const lastSchoolApplicationCount = await tx.admissionApplication.count({
          where: {
            lastSchoolId,
          },
        });

        if (lastSchoolApplicationCount > 1) {
          const lastSchoolAddress = await tx.address.create({
            data: lastSchoolAddressData,
          });
          const lastSchool = await tx.lastSchool.create({
            data: {
              ...lastSchoolData,
              addressId: lastSchoolAddress.id,
            },
          });

          lastSchoolId = lastSchool.id;
          lastSchoolAddressId = lastSchoolAddress.id;
        } else {
          if (latestApplication?.lastSchool?.addressId) {
            await tx.address.update({
              where: {
                id: latestApplication.lastSchool.addressId,
              },
              data: lastSchoolAddressData,
            });
          } else {
            const lastSchoolAddress = await tx.address.create({
              data: lastSchoolAddressData,
            });

            lastSchoolAddressId = lastSchoolAddress.id;
          }

          await tx.lastSchool.update({
            where: {
              id: lastSchoolId,
            },
            data: {
              ...lastSchoolData,
              addressId: lastSchoolAddressId,
            },
          });
        }
      } else {
        const lastSchoolAddress = await tx.address.create({
          data: lastSchoolAddressData,
        });

        const lastSchool = await tx.lastSchool.create({
          data: {
            ...lastSchoolData,
            addressId: lastSchoolAddress.id,
          },
        });

        lastSchoolId = lastSchool.id;
        lastSchoolAddressId = lastSchoolAddress.id;
      }

      if (latestApplication) {
        const shouldMarkReviewing =
          latestApplication.applicationStatus === ApplicationStatus.draft;
        await tx.admissionApplication.update({
          where: {
            id: latestApplication.id,
          },
          data: {
            lastSchoolId,
            LSSchoolYearEnd: normalizedInput.lastSchoolYear,
            LSAttainedLevelText: normalizedInput.lastSchoolYearLevel,
            ...(shouldMarkReviewing
              ? {
                  applicationStatus: ApplicationStatus.reviewing,
                  submittedAt: latestApplication.submittedAt ?? new Date(),
                }
              : {}),
            LSGraduationDate: normalizedInput.lastSchoolGraduationDate
              ? parseDateInput(normalizedInput.lastSchoolGraduationDate)
              : null,
          },
        });
      } else if (latestEnrollment && lastSchoolId) {
        await tx.admissionApplication.create({
          data: {
            studentId: student.id,
            applicantType: ApplicantType.existing,
            applicationStatus: ApplicationStatus.reviewing,
            lastSchoolId,
            LSSchoolYearEnd: normalizedInput.lastSchoolYear,
            LSAttainedLevelText: normalizedInput.lastSchoolYearLevel,
            LSGraduationDate: normalizedInput.lastSchoolGraduationDate
              ? parseDateInput(normalizedInput.lastSchoolGraduationDate)
              : null,
            branchId: latestEnrollment.branchId,
            programType: latestEnrollment.program.programType,
            programId: latestEnrollment.programId,
            academicLevelsId: latestEnrollment.academicLevelsId,
            remarks: "Created from secure student update link.",
            submittedAt: new Date(),
          },
        });
      }

      await tx.student.update({
        where: {
          id: student.id,
        },
        data: {
          ...studentDataFromProfile(normalizedInput, birthDate),
          addressId,
        },
      });
    });

    return {
      success: true,
      message: "Your student information has been updated.",
    };
  } catch (error) {
    console.error("Failed to update student record from email link:", error);

    return {
      success: false,
      message: "We could not update your student information right now.",
    };
  }
}
