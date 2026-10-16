import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { addressDataFromProfile, lastSchoolDataFromProfile, type UpdateStudentRecordInput } from "./student-fields";
import {
  hasCompleteLastSchoolIdentity,
  lastSchoolIdentityKey,
  lastSchoolIdentityParts,
} from "./last-school-identity";

export class LastSchoolSelectionError extends Error {
  constructor() {
    super("Previous school details changed. Select the school again.");
    this.name = "LastSchoolSelectionError";
  }
}

const schoolIdentitySelect = {
  verificationStatus: true,
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
} satisfies Prisma.LastSchoolSelect;

// These columns are fixed application constants, never values from a submitted form.
const identityColumns = [
  { name: 'school."school_name"', preserveCase: false },
  { name: 'school."school_id"', preserveCase: true },
  { name: 'school."short_name"', preserveCase: false },
  { name: 'school."school_type"::text', preserveCase: true },
  { name: 'address."house_number"', preserveCase: true },
  { name: 'address."subdivision"', preserveCase: false },
  { name: 'address."street"', preserveCase: false },
  { name: 'address."barangay"', preserveCase: false },
  { name: 'address."city"', preserveCase: false },
  { name: 'address."province"', preserveCase: false },
  { name: 'address."postal_code"', preserveCase: true },
] as const;

// PostgreSQL's locale-dependent space class omits some JavaScript whitespace characters.
const whitespacePattern = Prisma.raw("'[[:space:]\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+'");

/** School records are shared; choose or create a record instead of editing it in place. */
export async function resolveLastSchool(
  tx: Prisma.TransactionClient,
  profile: UpdateStudentRecordInput,
  selectedRecordId?: string,
  options: { allowIncomplete?: boolean } = {},
): Promise<{ id: bigint }> {
  const schoolData = lastSchoolDataFromProfile(profile);
  const addressData = addressDataFromProfile(profile, "lastSchool");
  const hasAddress = Object.values(addressData).some(Boolean);
  const identity = { ...schoolData, address: hasAddress ? addressData : null };

  if (!options.allowIncomplete && !hasCompleteLastSchoolIdentity(identity)) {
    throw new LastSchoolSelectionError();
  }

  if (selectedRecordId) {
    if (!/^[1-9]\d{0,18}$/.test(selectedRecordId)) throw new LastSchoolSelectionError();
    const id = BigInt(selectedRecordId);
    if (id > 9223372036854775807n) throw new LastSchoolSelectionError();

    const selectedSchool = await tx.lastSchool.findUnique({
      where: { id },
      select: schoolIdentitySelect,
    });

    if (
      !selectedSchool ||
      selectedSchool.verificationStatus !== "verified" ||
      (!options.allowIncomplete && !hasCompleteLastSchoolIdentity(selectedSchool)) ||
      lastSchoolIdentityKey(selectedSchool) !== lastSchoolIdentityKey(identity)
    ) {
      throw new LastSchoolSelectionError();
    }

    return { id };
  }

  const existing = await findMatchingLastSchool(tx, profile);
  if (existing) {
    if (existing.verificationStatus === "rejected") {
      // An explicit resubmission requests another review; students never verify a school.
      await tx.lastSchool.update({
        where: { id: existing.id },
        data: { verificationStatus: "pending", reviewedAt: null },
        select: { id: true },
      });
    }
    return { id: existing.id };
  }

  const address = hasAddress ? await tx.address.create({ data: addressData, select: { id: true } }) : null;
  return tx.lastSchool.create({
    data: { ...schoolData, addressId: address?.id ?? null, verificationStatus: "pending" },
    select: { id: true },
  });
}

/** The same normalized identity is used for student suggestions and administrator duplicate checks. */
export async function findMatchingLastSchool(tx: Prisma.TransactionClient, profile: UpdateStudentRecordInput, excludeId?: bigint) {
  const addressData = addressDataFromProfile(profile, "lastSchool");
  const hasAddress = Object.values(addressData).some(Boolean);
  const values = lastSchoolIdentityParts({ ...lastSchoolDataFromProfile(profile), address: hasAddress ? addressData : null });
  const conditions = identityColumns.map((column, index) => {
    const normalized = Prisma.sql`BTRIM(REGEXP_REPLACE(COALESCE(${Prisma.raw(column.name)}, ''), ${whitespacePattern}, ' ', 'g'))`;
    return column.preserveCase
      ? Prisma.sql`${normalized} = ${values[index]}`
      : Prisma.sql`LOWER(${normalized}) = ${values[index]}`;
  });
  const existing = await tx.$queryRaw<{ id: bigint; verificationStatus: string }[]>(Prisma.sql`
    SELECT school."id", school."verification_status" AS "verificationStatus"
    FROM "last_schools" school
    LEFT JOIN "addresses" address ON address."id" = school."address_id"
    WHERE ${hasAddress ? Prisma.sql`school."address_id" IS NOT NULL` : Prisma.sql`school."address_id" IS NULL`}
      AND ${Prisma.join(conditions, " AND ")}
      AND ${excludeId === undefined ? Prisma.sql`TRUE` : Prisma.sql`school."id" <> ${excludeId}`}
    ORDER BY CASE school."verification_status"
      WHEN 'verified' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END, school."id" ASC
    LIMIT 1
  `);

  return existing[0] ?? null;
}

/** Retry a rolled-back concurrent admission save without repeating external side effects. */
export async function runLastSchoolTransaction<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (
        attempt >= 2 ||
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2034"
      ) {
        throw error;
      }
    }
  }
}
