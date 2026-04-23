import { createHmac, timingSafeEqual } from "node:crypto";

import { CivilStatus, Gender } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { normalizeText } from "@/lib/utils";

const STUDENT_UPDATE_LINK_TTL_MS = 1000 * 60 * 60;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[+]?[\d\s()\-]{7,20}$/;

type StudentUpdateTokenPayload = {
  scope: "student-update";
  studentId: string;
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
  gender: string;
  civilStatus: string;
  citizenship: string;
  birthplace: string;
  religion: string;
  email: string;
  phone: string;
  facebookAccount: string;
  addressHouseNumber: string;
  addressSubdivision: string;
  addressStreet: string;
  addressBarangay: string;
  addressCity: string;
  addressProvince: string;
  addressPostalCode: string;
};

export type UpdateStudentRecordInput = {
  firstName: string;
  lastName: string;
  middleName: string;
  suffix: string;
  birthDate: string;
  gender: string;
  civilStatus: string;
  citizenship: string;
  birthplace: string;
  religion: string;
  email: string;
  phone: string;
  facebookAccount: string;
  addressHouseNumber: string;
  addressSubdivision: string;
  addressStreet: string;
  addressBarangay: string;
  addressCity: string;
  addressProvince: string;
  addressPostalCode: string;
};

type StudentUpdateQueryResult = {
  id: bigint;
  firstName: string;
  lastName: string;
  middleName: string | null;
  suffix: string | null;
  birthDate: Date;
  gender: string;
  civilStatus: string;
  citizenship: string;
  birthplace: string;
  religion: string | null;
  email: string;
  phone: string;
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

function verifyStudentUpdateToken(token: string) {
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
    gender: normalizeText(input.gender),
    civilStatus: normalizeText(input.civilStatus),
    citizenship: normalizeText(input.citizenship),
    birthplace: normalizeText(input.birthplace),
    religion: normalizeText(input.religion),
    email: normalizeText(input.email),
    phone: normalizeText(input.phone),
    facebookAccount: normalizeText(input.facebookAccount),
    addressHouseNumber: normalizeText(input.addressHouseNumber),
    addressSubdivision: normalizeText(input.addressSubdivision),
    addressStreet: normalizeText(input.addressStreet),
    addressBarangay: normalizeText(input.addressBarangay),
    addressCity: normalizeText(input.addressCity),
    addressProvince: normalizeText(input.addressProvince),
    addressPostalCode: normalizeText(input.addressPostalCode),
  };
}

function firstInvalidStudentUpdateField(input: UpdateStudentRecordInput) {
  const requiredFields: Array<[keyof UpdateStudentRecordInput, boolean]> = [
    ["firstName", !input.firstName],
    ["lastName", !input.lastName],
    ["birthDate", !input.birthDate],
    ["gender", !input.gender],
    ["civilStatus", !input.civilStatus],
    ["citizenship", !input.citizenship],
    ["birthplace", !input.birthplace],
    ["email", !input.email],
    ["phone", !input.phone],
    ["addressBarangay", !input.addressBarangay],
    ["addressCity", !input.addressCity],
    ["addressProvince", !input.addressProvince],
  ];

  const missingField = requiredFields.find(([, missing]) => missing)?.[0];

  if (missingField) {
    return missingField;
  }

  if (!parseDateInput(input.birthDate)) {
    return "birthDate";
  }

  if (!Object.values(Gender).includes(input.gender as (typeof Gender)[keyof typeof Gender])) {
    return "gender";
  }

  if (
    !Object.values(CivilStatus).includes(
      input.civilStatus as (typeof CivilStatus)[keyof typeof CivilStatus]
    )
  ) {
    return "civilStatus";
  }

  if (!isValidEmail(input.email)) {
    return "email";
  }

  if (!isValidPhone(input.phone)) {
    return "phone";
  }

  return null;
}

function mapStudentRecord(
  token: string,
  student: StudentUpdateQueryResult
): StudentUpdateRecord {
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
  };
}

export function createStudentUpdateUrl(studentId: string) {
  const payload: StudentUpdateTokenPayload = {
    scope: "student-update",
    studentId,
    exp: Date.now() + STUDENT_UPDATE_LINK_TTL_MS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signStudentUpdateToken(encodedPayload);

  return `${getAppBaseUrl()}/admission/update?token=${encodeURIComponent(`${encodedPayload}.${signature}`)}`;
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
        await tx.address.update({
          where: {
            id: addressId,
          },
          data: addressData,
        });
      } else {
        const address = await tx.address.create({
          data: addressData,
        });
        addressId = address.id;
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
            normalizedInput.gender as (typeof Gender)[keyof typeof Gender],
          civilStatus:
            normalizedInput.civilStatus as (typeof CivilStatus)[keyof typeof CivilStatus],
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
