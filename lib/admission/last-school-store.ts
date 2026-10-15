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
  selectedRecordId?: string
): Promise<{ id: bigint }> {
  const schoolData = lastSchoolDataFromProfile(profile);
  const addressData = addressDataFromProfile(profile, "lastSchool");
  const identity = { ...schoolData, address: addressData };

  if (!hasCompleteLastSchoolIdentity(identity)) {
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
      !hasCompleteLastSchoolIdentity(selectedSchool) ||
      lastSchoolIdentityKey(selectedSchool) !== lastSchoolIdentityKey(identity)
    ) {
      throw new LastSchoolSelectionError();
    }

    return { id };
  }

  const values = lastSchoolIdentityParts(identity);
  const conditions = identityColumns.map((column, index) => {
    const normalized = Prisma.sql`BTRIM(REGEXP_REPLACE(COALESCE(${Prisma.raw(column.name)}, ''), ${whitespacePattern}, ' ', 'g'))`;
    return column.preserveCase
      ? Prisma.sql`${normalized} = ${values[index]}`
      : Prisma.sql`LOWER(${normalized}) = ${values[index]}`;
  });
  const existing = await tx.$queryRaw<{ id: bigint }[]>(Prisma.sql`
    SELECT school."id"
    FROM "last_schools" school
    INNER JOIN "addresses" address ON address."id" = school."address_id"
    WHERE ${Prisma.join(conditions, " AND ")}
    ORDER BY school."id" ASC
    LIMIT 1
  `);

  if (existing[0]) return existing[0];

  const address = await tx.address.create({ data: addressData, select: { id: true } });
  return tx.lastSchool.create({
    data: { ...schoolData, addressId: address.id },
    select: { id: true },
  });
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
