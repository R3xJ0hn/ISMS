import { prisma } from "@/lib/prisma";
import { formatAddress } from "@/lib/utils";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { AdmissionLastSchool, AdmissionLastSchoolsResult } from "@/lib/types/last-schools";
import { hasCompleteLastSchoolIdentity, lastSchoolIdentityKey } from "./last-school-identity";

const lastSchoolSelect = {
  id: true,
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
} as const satisfies Prisma.LastSchoolSelect;

export async function getAdmissionLastSchools(): Promise<AdmissionLastSchoolsResult> {
  try {
    // Read school metadata only. Applicant and student relationships stay private.
    const records = await prisma.lastSchool.findMany({
      where: { verificationStatus: "verified" },
      orderBy: { id: "asc" },
      select: lastSchoolSelect,
    });
    const schoolsByIdentity = new Map<string, AdmissionLastSchool>();

    for (const record of records) {
      if (!hasCompleteLastSchoolIdentity(record)) continue;

      const identity = lastSchoolIdentityKey(record);
      if (schoolsByIdentity.has(identity)) continue;

      schoolsByIdentity.set(identity, {
        ...record,
        id: record.id.toString(),
        formattedAddress: formatAddress(record.address),
      });
    }

    return {
      schools: [...schoolsByIdentity.values()].toSorted((left, right) =>
        left.schoolName.localeCompare(right.schoolName) ||
        left.formattedAddress.localeCompare(right.formattedAddress)
      ),
    };
  } catch {
    return {
      schools: [],
      error: "Saved schools are unavailable right now. Choose Other to enter your school details.",
    };
  }
}
