import "server-only";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import type { Prisma } from "@/lib/generated/prisma/client";
import { SchoolType } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { addressSelect } from "@/lib/admission/records";
import { findMatchingLastSchool, resolveLastSchool, runLastSchoolTransaction } from "@/lib/admission/last-school-store";
import { hasCompleteLastSchoolIdentity } from "@/lib/admission/last-school-identity";
import { addressDataFromProfile, lastSchoolDataFromProfile, normalizeStudentUpdateInput, studentUpdateFields, type UpdateStudentRecordInput } from "@/lib/admission/student-fields";
import { capitalizeInputText, enumIncludes, formatAddress, formatStudentName, parsePositiveSafeInteger, parseRecordId, readFormText, sanitizeInputText } from "@/lib/utils";
import type { LastSchoolField, LastSchoolFormRecord, LastSchoolFormState, LastSchoolStudentsPage, LastSchoolTableRow } from "./types";

const schoolSelect = {
  id: true, schoolName: true, schoolId: true, shortName: true, schoolType: true, addressId: true,
  verificationStatus: true, reviewedAt: true, createdAt: true,
  address: { select: addressSelect },
} as const satisfies Prisma.LastSchoolSelect;
type SchoolRecord = Prisma.LastSchoolGetPayload<{ select: typeof schoolSelect }>;
const fieldLimits = { schoolName: 255, shortName: 80, street: 160, barangay: 120, city: 120, province: 120, postalCode: 20 } as const;
const missingSchool = (): LastSchoolFormState => ({ success: false, message: "This school no longer exists. Return to Manage Last Schools and try again." });

function formRecord(school: SchoolRecord): LastSchoolFormRecord {
  return {
    id: school.id.toString(), schoolIdentifier: school.schoolId ?? "", schoolName: school.schoolName, shortName: school.shortName ?? "", schoolType: school.schoolType,
    street: school.address?.street ?? "", barangay: school.address?.barangay ?? "", city: school.address?.city ?? "",
    province: school.address?.province ?? "", postalCode: school.address?.postalCode ?? "", verificationStatus: school.verificationStatus,
  };
}

export async function getManagedLastSchools(): Promise<LastSchoolTableRow[]> {
  await requireAdmin();
  const schools = await prisma.lastSchool.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { ...schoolSelect, _count: { select: { applications: true } } },
  });
  return schools.map((school) => ({
    ...formRecord(school), formattedAddress: formatAddress(school.address), applicationCount: school._count.applications,
    createdAt: school.createdAt.toISOString(), reviewedAt: school.reviewedAt?.toISOString() ?? null,
  }));
}

export async function getManagedLastSchool(schoolId: string): Promise<LastSchoolFormRecord | null> {
  await requireAdmin();
  const id = parseRecordId(schoolId, { canonical: true, maxDigits: 19 });
  if (id === null) return null;
  const school = await prisma.lastSchool.findUnique({ where: { id }, select: schoolSelect });
  return school ? formRecord(school) : null;
}

/** Bounded admission records linked to one school; no contact or account details are exposed. */
export async function getManagedLastSchoolStudents(schoolId: string, search: {
  query?: string | string[];
  page?: string | string[];
} = {}): Promise<LastSchoolStudentsPage | null> {
  await requireAdmin();
  const id = parseRecordId(schoolId, { canonical: true, maxDigits: 19 });
  if (id === null) return null;
  const school = await prisma.lastSchool.findUnique({ where: { id }, select: { id: true, schoolName: true } });
  if (!school) return null;

  const query = sanitizeInputText(typeof search.query === "string" ? search.query : "").slice(0, 120).trim();
  const requestedPage = typeof search.page === "string" ? parsePositiveSafeInteger(search.page) ?? 1 : 1;
  const pageSize = 25;
  const where: Prisma.AdmissionApplicationWhereInput = {
    lastSchoolId: id,
    ...(query ? { AND: query.split(/\s+/).map((term) => {
      const contains = { contains: term.replace(/[\\%_]/g, (character) => `\\${character}`), mode: "insensitive" as const };
      return { OR: [
        { student: { firstName: contains } }, { student: { middleName: contains } },
        { student: { lastName: contains } }, { student: { suffix: contains } }, { student: { studentNumber: contains } },
        { branch: { title: contains } }, { program: { code: contains } }, { program: { label: contains } },
      ] };
    }) } : {}),
  };
  const total = await prisma.admissionApplication.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const applications = await prisma.admissionApplication.findMany({
    where,
    orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }, { id: "asc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      applicationStatus: true,
      student: { select: { firstName: true, middleName: true, lastName: true, suffix: true, studentNumber: true } },
      branch: { select: { title: true } },
      program: { select: { code: true, label: true } },
    },
  });
  return {
    school: { id: school.id.toString(), schoolName: school.schoolName }, query, page, pageSize, total, totalPages,
    students: applications.map((application) => ({
      applicationId: application.id.toString(), name: formatStudentName(application.student),
      studentNumber: application.student.studentNumber, branch: application.branch.title,
      program: `${application.program.code} - ${application.program.label}`, applicationStatus: application.applicationStatus,
    })),
  };
}

function parseSchoolForm(formData: FormData) {
  const values = Object.fromEntries(Object.keys(fieldLimits).map((field) => [
    field, field === "postalCode" ? sanitizeInputText(readFormText(formData, field)) : capitalizeInputText(readFormText(formData, field)),
  ])) as Record<keyof typeof fieldLimits, string>;
  const schoolType = readFormText(formData, "schoolType");
  const schoolIdentifier = sanitizeInputText(readFormText(formData, "schoolIdentifier"));
  const fieldErrors: NonNullable<LastSchoolFormState["fieldErrors"]> = {};
  if (!schoolIdentifier) fieldErrors.schoolIdentifier = "Enter the school ID.";
  if (schoolIdentifier.length > 100) fieldErrors.schoolIdentifier = "Use 100 characters or fewer.";
  for (const field of ["schoolName", "barangay", "city", "province"] as const) {
    if (!values[field]) fieldErrors[field] = "Complete this field.";
  }
  for (const [field, limit] of Object.entries(fieldLimits)) {
    if (values[field as keyof typeof fieldLimits].length > limit) fieldErrors[field as LastSchoolField] = `Use ${limit} characters or fewer.`;
  }
  if (!enumIncludes(SchoolType, schoolType)) fieldErrors.schoolType = "Choose a valid school type.";
  return { values, schoolType, schoolIdentifier, fieldErrors };
}

function schoolProfile(values: ReturnType<typeof parseSchoolForm>["values"], schoolType: string, schoolIdentifier: string, saved?: SchoolRecord) {
  return normalizeStudentUpdateInput({
    ...Object.fromEntries(studentUpdateFields.map((field) => [field, ""])),
    lastSchoolName: values.schoolName, lastSchoolShortName: values.shortName, lastSchoolType: schoolType,
    lastSchoolId: schoolIdentifier, lastSchoolHouseNumber: saved?.address?.houseNumber ?? "",
    lastSchoolSubdivision: saved?.address?.subdivision ?? "", lastSchoolStreet: values.street,
    lastSchoolBarangay: values.barangay, lastSchoolCity: values.city, lastSchoolProvince: values.province, lastSchoolPostalCode: values.postalCode,
  } as UpdateStudentRecordInput);
}

function refreshSchools() {
  for (const path of ["/portal/last-schools", "/portal/admission", "/portal/students", "/portal/admission-review", "/portal/information", "/admission"]) revalidatePath(path);
  revalidatePath("/portal/last-schools/[schoolId]/edit", "page");
  revalidatePath("/portal/last-schools/[schoolId]/students", "page");
  revalidatePath("/portal/admission/[applicationId]/edit", "page");
  revalidatePath("/portal/students/[applicationId]", "page");
}

async function saveSchoolAddress(tx: Prisma.TransactionClient, school: SchoolRecord, profile: UpdateStudentRecordInput) {
  const data = addressDataFromProfile(profile, "lastSchool");
  if (school.addressId !== null && school.address) {
    if (Object.entries(data).every(([field, value]) => school.address?.[field as keyof typeof data] === value)) return school.addressId;
    const [students, guardians, branches, schools] = await Promise.all([
      tx.student.count({ where: { addressId: school.addressId } }),
      tx.guardian.count({ where: { addressId: school.addressId } }),
      tx.branch.count({ where: { addressId: school.addressId } }),
      tx.lastSchool.count({ where: { addressId: school.addressId } }),
    ]);
    if (!students && !guardians && !branches && schools === 1) {
      await tx.address.update({ where: { id: school.addressId }, data });
      return school.addressId;
    }
  }
  return (await tx.address.create({ data, select: { id: true } })).id;
}

export async function saveManagedLastSchool(formData: FormData): Promise<LastSchoolFormState> {
  await requireAdmin();
  const editing = formData.has("schoolId");
  const id = editing ? parseRecordId(readFormText(formData, "schoolId"), { canonical: true, maxDigits: 19 }) : null;
  if (editing && id === null) return missingSchool();
  const intent = readFormText(formData, "intent") || (editing ? "save" : "verify");
  if (intent !== "save" && intent !== "verify") return { success: false, message: "Choose Save changes or Save and verify." };
  const parsed = parseSchoolForm(formData);
  if (Object.keys(parsed.fieldErrors).length) return { success: false, message: "Check the school details before saving.", fieldErrors: parsed.fieldErrors };
  let result: LastSchoolFormState;
  try {
    result = await runLastSchoolTransaction(async (tx): Promise<LastSchoolFormState> => {
      const saved = id === null ? null : await tx.lastSchool.findUnique({ where: { id }, select: schoolSelect });
      if (id !== null && !saved) return missingSchool();
      const profile = schoolProfile(parsed.values, parsed.schoolType, parsed.schoolIdentifier, saved ?? undefined);
      if (saved) {
        const duplicate = await findMatchingLastSchool(tx, profile, saved.id);
        if (duplicate) return { success: false, message: "Another saved school already matches these details. Review that record instead.", fieldErrors: { schoolName: "These school details are already saved." } };
        const addressId = await saveSchoolAddress(tx, saved, profile);
        await tx.lastSchool.update({
          where: { id: saved.id },
          data: {
            ...lastSchoolDataFromProfile(profile), addressId,
            ...(intent === "verify" || saved.verificationStatus === "verified"
              ? { verificationStatus: "verified", reviewedAt: new Date() } : {}),
          },
        });
      } else {
        const school = await resolveLastSchool(tx, profile, undefined, { matchSuggestion: false });
        await tx.lastSchool.update({ where: { id: school.id }, data: { verificationStatus: "verified", reviewedAt: new Date() } });
      }
      return { success: true, message: saved ? intent === "verify" ? "School details saved and verified." : "School details updated." : "School added and verified." };
    });
  } catch {
    console.error("Failed to save managed school.");
    return { success: false, message: "Unable to save this school right now. Please try again." };
  }
  if (result.success) refreshSchools();
  return result;
}

export async function reviewManagedLastSchool(formData: FormData): Promise<LastSchoolFormState> {
  await requireAdmin();
  const id = parseRecordId(readFormText(formData, "schoolId"), { canonical: true, maxDigits: 19 });
  const decision = readFormText(formData, "decision");
  if (id === null) return missingSchool();
  if (decision !== "verify" && decision !== "reject") return { success: false, message: "Choose whether to verify or reject the school." };
  let result: LastSchoolFormState;
  try {
    result = await runLastSchoolTransaction(async (tx): Promise<LastSchoolFormState> => {
      const school = await tx.lastSchool.findUnique({ where: { id }, select: schoolSelect });
      if (!school) return missingSchool();
      if (decision === "verify" && !hasCompleteLastSchoolIdentity(school)) return { success: false, message: "Edit this school and complete its name, type, and address before verifying it." };
      if (school.verificationStatus === "verified" && decision === "reject") return { success: false, message: "This school has already been verified. Reload the list before reviewing suggestions." };
      const updated = await tx.lastSchool.updateMany({
        where: { id, verificationStatus: school.verificationStatus },
        data: { verificationStatus: decision === "verify" ? "verified" : "rejected", reviewedAt: new Date() },
      });
      return updated.count === 1 ? { success: true, message: decision === "verify" ? "School verified and available to students." : "School suggestion rejected." }
        : { success: false, message: "This school changed while you were reviewing it. Reload the list and try again." };
    });
  } catch {
    console.error("Failed to review managed school.");
    return { success: false, message: "Unable to review this school right now. Please try again." };
  }
  if (result.success) refreshSchools();
  return result;
}
