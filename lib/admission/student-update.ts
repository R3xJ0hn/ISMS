import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import {
  ApplicantType,
  ApplicationStatus,
  CivilStatus,
  Gender,
  ProgramType,
  SchoolType,
} from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { normalizeText } from "@/lib/utils";

const STUDENT_UPDATE_LINK_TTL_MS = 1000 * 60 * 60;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[+]?[\d\s()\-]{7,20}$/;

export type StudentUpdateTokenPayload = {
  scope: "student-update";
  studentId: string;
  jti: string;
  exp: number;
};

export type StudentUpdateRecord = {
  token: string;
  studentId: string;
  firstName: string;
  lastName: string;
  middleName: string;
  suffix: string;
  birthDate: string;
  gender: string | null;
  civilStatus: string | null;
  citizenship: string | null;
  birthplace: string | null;
  religion: string;
  email: string;
  phone: string | null;
  facebookAccount: string;
  addressHouseNumber: string;
  addressSubdivision: string;
  addressStreet: string;
  addressBarangay: string;
  addressCity: string;
  addressProvince: string;
  addressPostalCode: string;
  guardianFirstName: string;
  guardianLastName: string;
  guardianMiddleName: string;
  guardianSuffix: string;
  guardianRelationship: string;
  guardianContactNumber: string;
  guardianOccupation: string;
  lastSchoolName: string;
  lastSchoolId: string;
  lastSchoolShortName: string;
  lastSchoolType: string;
  lastSchoolHouseNumber: string;
  lastSchoolSubdivision: string;
  lastSchoolStreet: string;
  lastSchoolBarangay: string;
  lastSchoolCity: string;
  lastSchoolProvince: string;
  lastSchoolPostalCode: string;
  lastSchoolYear: string;
  lastSchoolGraduationDate: string;
  lastSchoolYearLevel: string;
  latestEnrollmentStatus: string;
  latestEnrollmentSchoolYear: string;
  latestEnrollmentBranch: string;
  latestEnrollmentProgram: string;
  latestEnrollmentYearLevel: string;
  latestEnrollmentSection: string;
};

export type UpdateStudentRecordInput = {
  firstName: string;
  lastName: string;
  middleName: string;
  suffix: string;
  birthDate: string;
  gender?: string | null;
  civilStatus?: string | null;
  citizenship?: string | null;
  birthplace?: string | null;
  religion: string;
  email: string;
  phone?: string | null;
  facebookAccount: string;
  addressHouseNumber: string;
  addressSubdivision: string;
  addressStreet: string;
  addressBarangay: string;
  addressCity: string;
  addressProvince: string;
  addressPostalCode: string;
  guardianFirstName: string;
  guardianLastName: string;
  guardianMiddleName: string;
  guardianSuffix: string;
  guardianRelationship: string;
  guardianContactNumber: string;
  guardianOccupation: string;
  lastSchoolName: string;
  lastSchoolId: string;
  lastSchoolShortName: string;
  lastSchoolType: string;
  lastSchoolHouseNumber: string;
  lastSchoolSubdivision: string;
  lastSchoolStreet: string;
  lastSchoolBarangay: string;
  lastSchoolCity: string;
  lastSchoolProvince: string;
  lastSchoolPostalCode: string;
  lastSchoolYear: string;
  lastSchoolGraduationDate: string;
  lastSchoolYearLevel: string;
};

type StudentUpdateQueryResult = {
  id: bigint;
  firstName: string;
  lastName: string;
  middleName: string | null;
  suffix: string | null;
  birthDate: Date;
  gender: string | null;
  civilStatus: string | null;
  citizenship: string | null;
  birthplace: string | null;
  religion: string | null;
  email: string;
  phone: string | null;
  facebookAccount: string | null;
  address: {
    houseNumber: string | null;
    subdivision: string | null;
    street: string | null;
    barangay: string;
    city: string;
    province: string;
    postalCode: string | null;
  } | null;
  guardians: Array<{
    relationship: string;
    isPrimary: boolean;
    guardian: {
      firstName: string;
      lastName: string;
      middleName: string | null;
      suffix: string | null;
      contactNumber: string;
      occupation: string | null;
    };
  }>;
  applications: Array<{
    id: bigint;
    branchId: bigint;
    programId: bigint;
    academicLevelsId: bigint;
    programType: (typeof ProgramType)[keyof typeof ProgramType];
    lastSchoolId: bigint | null;
    LSSchoolYearEnd: string | null;
    LSAttainedLevelText: string | null;
    LSGraduationDate: Date | null;
    applicationStatus: (typeof ApplicationStatus)[keyof typeof ApplicationStatus];
    submittedAt: Date | null;
    lastSchool: {
      schoolName: string;
      schoolId: string | null;
      shortName: string | null;
      schoolType: (typeof SchoolType)[keyof typeof SchoolType];
      address: {
        houseNumber: string | null;
        subdivision: string | null;
        street: string | null;
        barangay: string;
        city: string;
        province: string;
        postalCode: string | null;
      } | null;
    } | null;
  }>;
  enrollments: Array<{
    branchId: bigint;
    programId: bigint;
    academicLevelsId: bigint;
    enrollmentStatus: string;
    schoolYear: {
      name: string;
    };
    branch: {
      title: string;
    };
    program: {
      label: string;
      programType: (typeof ProgramType)[keyof typeof ProgramType];
    };
    academicLevels: {
      label: string;
    };
    section: {
      sectionName: string;
      sectionCode: string;
    } | null;
  }>;
};

function optionalText(value: string) {
  return value ? value : null;
}

function parseDateInput(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number.parseInt(yearText, 10);
  const month = Number.parseInt(monthText, 10);
  const day = Number.parseInt(dayText, 10);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function isValidEmail(value: string) {
  return emailPattern.test(value);
}

function isValidPhone(value: string) {
  if (!phonePattern.test(value)) {
    return false;
  }

  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

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

function getAppBaseUrl() {
  if (process.env.APP_URL) {
    return process.env.APP_URL;
  }

  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}

function normalizeStudentUpdateInput(
  input: UpdateStudentRecordInput
): UpdateStudentRecordInput {
  return {
    firstName: normalizeText(input.firstName),
    lastName: normalizeText(input.lastName),
    middleName: normalizeText(input.middleName),
    suffix: normalizeText(input.suffix),
    birthDate: normalizeText(input.birthDate),
    gender: normalizeNullableText(input.gender),
    civilStatus: normalizeNullableText(input.civilStatus),
    citizenship: normalizeNullableText(input.citizenship),
    birthplace: normalizeNullableText(input.birthplace),
    religion: normalizeText(input.religion),
    email: normalizeText(input.email),
    phone: normalizeNullableText(input.phone),
    facebookAccount: normalizeText(input.facebookAccount),
    addressHouseNumber: normalizeText(input.addressHouseNumber),
    addressSubdivision: normalizeText(input.addressSubdivision),
    addressStreet: normalizeText(input.addressStreet),
    addressBarangay: normalizeText(input.addressBarangay),
    addressCity: normalizeText(input.addressCity),
    addressProvince: normalizeText(input.addressProvince),
    addressPostalCode: normalizeText(input.addressPostalCode),
    guardianFirstName: normalizeText(input.guardianFirstName),
    guardianLastName: normalizeText(input.guardianLastName),
    guardianMiddleName: normalizeText(input.guardianMiddleName),
    guardianSuffix: normalizeText(input.guardianSuffix),
    guardianRelationship: normalizeText(input.guardianRelationship),
    guardianContactNumber: normalizeText(input.guardianContactNumber),
    guardianOccupation: normalizeText(input.guardianOccupation),
    lastSchoolName: normalizeText(input.lastSchoolName),
    lastSchoolId: normalizeText(input.lastSchoolId),
    lastSchoolShortName: normalizeText(input.lastSchoolShortName),
    lastSchoolType: normalizeText(input.lastSchoolType),
    lastSchoolHouseNumber: normalizeText(input.lastSchoolHouseNumber),
    lastSchoolSubdivision: normalizeText(input.lastSchoolSubdivision),
    lastSchoolStreet: normalizeText(input.lastSchoolStreet),
    lastSchoolBarangay: normalizeText(input.lastSchoolBarangay),
    lastSchoolCity: normalizeText(input.lastSchoolCity),
    lastSchoolProvince: normalizeText(input.lastSchoolProvince),
    lastSchoolPostalCode: normalizeText(input.lastSchoolPostalCode),
    lastSchoolYear: normalizeText(input.lastSchoolYear),
    lastSchoolGraduationDate: normalizeText(input.lastSchoolGraduationDate),
    lastSchoolYearLevel: normalizeText(input.lastSchoolYearLevel),
  };
}

function normalizeNullableText(value: string | null | undefined) {
  if (value == null) {
    return null;
  }

  const normalizedValue = normalizeText(value);

  return normalizedValue || null;
}

function firstInvalidStudentUpdateField(input: UpdateStudentRecordInput) {
  const requiredFields: Array<[keyof UpdateStudentRecordInput, boolean]> = [
    ["firstName", !input.firstName],
    ["lastName", !input.lastName],
    ["birthDate", !input.birthDate],
    ["email", !input.email],
    ["addressBarangay", !input.addressBarangay],
    ["addressCity", !input.addressCity],
    ["addressProvince", !input.addressProvince],
    ["guardianFirstName", !input.guardianFirstName],
    ["guardianLastName", !input.guardianLastName],
    ["guardianRelationship", !input.guardianRelationship],
    ["guardianContactNumber", !input.guardianContactNumber],
    ["lastSchoolName", !input.lastSchoolName],
    ["lastSchoolType", !input.lastSchoolType],
    ["lastSchoolBarangay", !input.lastSchoolBarangay],
    ["lastSchoolCity", !input.lastSchoolCity],
    ["lastSchoolProvince", !input.lastSchoolProvince],
    ["lastSchoolYear", !input.lastSchoolYear],
    ["lastSchoolYearLevel", !input.lastSchoolYearLevel],
  ];

  const missingField = requiredFields.find(([, missing]) => missing)?.[0];

  if (missingField) {
    return missingField;
  }

  if (!parseDateInput(input.birthDate)) {
    return "birthDate";
  }

  if (
    input.gender &&
    !Object.values(Gender).includes(input.gender as (typeof Gender)[keyof typeof Gender])
  ) {
    return "gender";
  }

  if (
    input.civilStatus &&
    !Object.values(CivilStatus).includes(
      input.civilStatus as (typeof CivilStatus)[keyof typeof CivilStatus]
    )
  ) {
    return "civilStatus";
  }

  if (!isValidEmail(input.email)) {
    return "email";
  }

  if (input.phone && !isValidPhone(input.phone)) {
    return "phone";
  }

  if (!isValidPhone(input.guardianContactNumber)) {
    return "guardianContactNumber";
  }

  if (
    !Object.values(SchoolType).includes(
      input.lastSchoolType as (typeof SchoolType)[keyof typeof SchoolType]
    )
  ) {
    return "lastSchoolType";
  }

  return null;
}

function mapStudentRecord(
  token: string,
  student: StudentUpdateQueryResult
): StudentUpdateRecord {
  const primaryGuardian =
    student.guardians.find((guardian) => guardian.isPrimary) ??
    student.guardians[0];
  const latestApplication = student.applications[0];
  const lastSchool = latestApplication?.lastSchool;
  const latestEnrollment = student.enrollments[0];

  return {
    token,
    studentId: student.id.toString(),
    firstName: student.firstName,
    lastName: student.lastName,
    middleName: student.middleName ?? "",
    suffix: student.suffix ?? "",
    birthDate: student.birthDate.toISOString().slice(0, 10),
    gender: student.gender,
    civilStatus: student.civilStatus,
    citizenship: student.citizenship,
    birthplace: student.birthplace,
    religion: student.religion ?? "",
    email: student.email,
    phone: student.phone,
    facebookAccount: student.facebookAccount ?? "",
    addressHouseNumber: student.address?.houseNumber ?? "",
    addressSubdivision: student.address?.subdivision ?? "",
    addressStreet: student.address?.street ?? "",
    addressBarangay: student.address?.barangay ?? "",
    addressCity: student.address?.city ?? "",
    addressProvince: student.address?.province ?? "",
    addressPostalCode: student.address?.postalCode ?? "",
    guardianFirstName: primaryGuardian?.guardian.firstName ?? "",
    guardianLastName: primaryGuardian?.guardian.lastName ?? "",
    guardianMiddleName: primaryGuardian?.guardian.middleName ?? "",
    guardianSuffix: primaryGuardian?.guardian.suffix ?? "",
    guardianRelationship: primaryGuardian?.relationship ?? "",
    guardianContactNumber: primaryGuardian?.guardian.contactNumber ?? "",
    guardianOccupation: primaryGuardian?.guardian.occupation ?? "",
    lastSchoolName: lastSchool?.schoolName ?? "",
    lastSchoolId: lastSchool?.schoolId ?? "",
    lastSchoolShortName: lastSchool?.shortName ?? "",
    lastSchoolType: lastSchool?.schoolType ?? "",
    lastSchoolHouseNumber: lastSchool?.address?.houseNumber ?? "",
    lastSchoolSubdivision: lastSchool?.address?.subdivision ?? "",
    lastSchoolStreet: lastSchool?.address?.street ?? "",
    lastSchoolBarangay: lastSchool?.address?.barangay ?? "",
    lastSchoolCity: lastSchool?.address?.city ?? "",
    lastSchoolProvince: lastSchool?.address?.province ?? "",
    lastSchoolPostalCode: lastSchool?.address?.postalCode ?? "",
    lastSchoolYear: latestApplication?.LSSchoolYearEnd ?? "",
    lastSchoolGraduationDate:
      latestApplication?.LSGraduationDate?.toISOString().slice(0, 10) ?? "",
    lastSchoolYearLevel: latestApplication?.LSAttainedLevelText ?? "",
    latestEnrollmentStatus: latestEnrollment?.enrollmentStatus ?? "",
    latestEnrollmentSchoolYear: latestEnrollment?.schoolYear.name ?? "",
    latestEnrollmentBranch: latestEnrollment?.branch.title ?? "",
    latestEnrollmentProgram: latestEnrollment?.program.label ?? "",
    latestEnrollmentYearLevel: latestEnrollment?.academicLevels.label ?? "",
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

  return `${getAppBaseUrl()}/admission/update?token=${encodeURIComponent(token)}`;
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
    select: {
      id: true,
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
          isPrimary: true,
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
          LSSchoolYearEnd: true,
          LSAttainedLevelText: true,
          LSGraduationDate: true,
          applicationStatus: true,
          submittedAt: true,
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
      },
      enrollments: {
        orderBy: [{ schoolYearId: "desc" }, { enrolledAt: "desc" }],
        take: 1,
        select: {
          branchId: true,
          programId: true,
          academicLevelsId: true,
          enrollmentStatus: true,
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
              programType: true,
            },
          },
          academicLevels: {
            select: {
              label: true,
            },
          },
          section: {
            select: {
              sectionName: true,
              sectionCode: true,
            },
          },
        },
      },
    },
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

      const addressData = {
        houseNumber: optionalText(normalizedInput.addressHouseNumber),
        subdivision: optionalText(normalizedInput.addressSubdivision),
        street: optionalText(normalizedInput.addressStreet),
        barangay: normalizedInput.addressBarangay,
        city: normalizedInput.addressCity,
        province: normalizedInput.addressProvince,
        postalCode: optionalText(normalizedInput.addressPostalCode),
      };

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

      if (primaryGuardianLink) {
        const guardianData = {
          firstName: normalizedInput.guardianFirstName,
          lastName: normalizedInput.guardianLastName,
          middleName: optionalText(normalizedInput.guardianMiddleName),
          suffix: optionalText(normalizedInput.guardianSuffix),
          contactNumber: normalizedInput.guardianContactNumber,
          occupation: optionalText(normalizedInput.guardianOccupation),
        };
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
            firstName: normalizedInput.guardianFirstName,
            lastName: normalizedInput.guardianLastName,
            middleName: optionalText(normalizedInput.guardianMiddleName),
            suffix: optionalText(normalizedInput.guardianSuffix),
            contactNumber: normalizedInput.guardianContactNumber,
            occupation: optionalText(normalizedInput.guardianOccupation),
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

      const lastSchoolAddressData = {
        houseNumber: optionalText(normalizedInput.lastSchoolHouseNumber),
        subdivision: optionalText(normalizedInput.lastSchoolSubdivision),
        street: optionalText(normalizedInput.lastSchoolStreet),
        barangay: normalizedInput.lastSchoolBarangay,
        city: normalizedInput.lastSchoolCity,
        province: normalizedInput.lastSchoolProvince,
        postalCode: optionalText(normalizedInput.lastSchoolPostalCode),
      };

      const latestApplication = student.applications[0];
      const latestEnrollment = student.enrollments[0];
      let lastSchoolId = latestApplication?.lastSchoolId ?? null;
      let lastSchoolAddressId = latestApplication?.lastSchool?.addressId ?? null;
      const lastSchoolData = {
        schoolName: normalizedInput.lastSchoolName,
        schoolId: optionalText(normalizedInput.lastSchoolId),
        shortName: optionalText(normalizedInput.lastSchoolShortName),
        schoolType:
          normalizedInput.lastSchoolType as (typeof SchoolType)[keyof typeof SchoolType],
      };

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
          firstName: normalizedInput.firstName,
          lastName: normalizedInput.lastName,
          middleName: optionalText(normalizedInput.middleName),
          suffix: optionalText(normalizedInput.suffix),
          birthDate,
          gender:
            normalizedInput.gender === null
              ? null
              : normalizedInput.gender as (typeof Gender)[keyof typeof Gender],
          civilStatus:
            normalizedInput.civilStatus === null
              ? null
              : normalizedInput.civilStatus as (typeof CivilStatus)[keyof typeof CivilStatus],
          citizenship: normalizedInput.citizenship,
          birthplace: normalizedInput.birthplace,
          religion: optionalText(normalizedInput.religion),
          email: normalizedInput.email,
          phone: normalizedInput.phone,
          facebookAccount: optionalText(normalizedInput.facebookAccount),
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
