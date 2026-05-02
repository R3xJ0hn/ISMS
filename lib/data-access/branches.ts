import { unstable_cache } from "next/cache";

import { allowedAcademicLevelSlugsByProgramType } from "@/lib/admission/constants";
import type {
  AdmissionAcademicLevelOption,
  AdmissionBranch,
  InternalProgramOption,
} from "@/lib/types";
import { prisma } from "@/lib/prisma";
import { formatCompleteAddress } from "@/lib/utils";

const branchSelect = {
  id: true,
  slug: true,
  title: true,
  image: true,
  phone: true,
  facebookText: true,
  mapLink: true,
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
} as const;

const academicLevelOrder = new Map(
  [
    "grade-11",
    "grade-12",
    "first-year",
    "second-year",
    "third-year",
    "fourth-year",
  ].map((value, index) => [value, index])
);

const programTypeOrder = new Map(
  ["Bachelor", "SeniorHigh", "Associate"].map((value, index) => [value, index])
);

function sortAcademicLevels(
  left: { label: string; slug: string },
  right: { label: string; slug: string }
) {
  const orderDifference =
    (academicLevelOrder.get(left.slug) ?? Number.MAX_SAFE_INTEGER) -
    (academicLevelOrder.get(right.slug) ?? Number.MAX_SAFE_INTEGER);

  if (orderDifference !== 0) {
    return orderDifference;
  }

  return left.label.localeCompare(right.label);
}

function sortPrograms(left: InternalProgramOption, right: InternalProgramOption) {
  const typeDifference =
    (programTypeOrder.get(left.programType) ?? Number.MAX_SAFE_INTEGER) -
    (programTypeOrder.get(right.programType) ?? Number.MAX_SAFE_INTEGER);

  if (typeDifference !== 0) {
    return typeDifference;
  }

  return left.label.localeCompare(right.label);
}

export const getCachedAdmissionBranches = unstable_cache(
  async (): Promise<AdmissionBranch[]> => {
    const branches = await prisma.branch.findMany({
      orderBy: {
        title: "asc",
      },
      select: branchSelect,
    });

    return branches.map(({ id, slug, address, ...branch }) => ({
      ...branch,
      id: id.toString(),
      code: slug,
      address,
      formattedAddress: formatCompleteAddress(address),
    }));
  },
  ["admission-branches"],
  {
    revalidate: 300,
  }
);

export async function getAdmissionProgramOfferings(branchId: bigint) {
  const branch = await prisma.branch.findUnique({
    where: {
      id: branchId,
    },
    select: {
      id: true,
      slug: true,
      title: true,
      sections: {
        select: {
          program: {
            select: {
              id: true,
              code: true,
              label: true,
              programType: true,
            },
          },
          academicLevels: {
            select: {
              id: true,
              label: true,
              slug: true,
            },
          },
        },
      },
    },
  });

  if (!branch) {
    return null;
  }

  const programsById = new Map<string, InternalProgramOption>();

  for (const section of branch.sections) {
    const programId = section.program.id.toString();
    const allowedSlugs =
      allowedAcademicLevelSlugsByProgramType[section.program.programType];

    if (!allowedSlugs.includes(section.academicLevels.slug)) {
      continue;
    }

    let program = programsById.get(programId);

    if (!program) {
      program = {
        id: programId,
        code: section.program.code,
        label: section.program.label,
        programType: section.program.programType,
        academicLevels: new Map<string, AdmissionAcademicLevelOption>(),
      };
      programsById.set(programId, program);
    }

    program.academicLevels.set(section.academicLevels.id.toString(), {
      id: section.academicLevels.id.toString(),
      label: section.academicLevels.label,
      slug: section.academicLevels.slug,
    });
  }

  return {
    branch: {
      id: branch.id.toString(),
      title: branch.title,
      code: branch.slug,
    },
    programs: Array.from(programsById.values())
      .toSorted(sortPrograms)
      .map(({ academicLevels, ...program }) => ({
        ...program,
        academicLevels: Array.from(academicLevels.values()).toSorted(
          sortAcademicLevels
        ),
      })),
  };
}
