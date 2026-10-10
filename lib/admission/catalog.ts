import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { normalizeText } from "@/lib/utils";
import { allowedAcademicLevelSlugsByProgramType } from "./constants";
import { addressSelect } from "./records";
import type { BranchAddress, AdmissionAcademicLevelOption, AdmissionBranchesResult, AdmissionProgramOptionsResult } from "./types";

type InternalProgramOption = {
  id: string;
  code: string;
  label: string;
  programType: string;
  academicLevels: Map<string, AdmissionAcademicLevelOption>;
};

const branchSelect = {
  id: true,
  slug: true,
  title: true,
  image: true,
  phone: true,
  facebookText: true,
  mapLink: true,
  address: {
    select: addressSelect,
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

function formatAddress(address: BranchAddress | null) {
  if (!address) {
    return "";
  }

  return [
    address.houseNumber,
    address.street,
    address.subdivision,
    address.barangay,
    address.city,
    address.province,
    address.postalCode,
  ]
    .filter(Boolean)
    .join(", ");
}

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

const getCachedBranches = unstable_cache(
  async () => {
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
      formattedAddress: formatAddress(address),
    }));
  },
  ["admission-branches"],
  {
    revalidate: 300,
  }
);

export async function getAdmissionBranches(): Promise<AdmissionBranchesResult> {
  try {
    return {
      branches: await getCachedBranches(),
    };
  } catch (error) {
    console.error("Failed to fetch branches:", error);

    return {
      branches: [],
      error: "Failed to fetch branches.",
    };
  }
}

export async function getAdmissionProgramOptions(
  branchId: string
): Promise<AdmissionProgramOptionsResult> {
  const normalizedBranchId = normalizeText(branchId);

  if (!/^\d+$/.test(normalizedBranchId)) {
    return {
      programs: [],
      error: "A valid branchId is required.",
    };
  }

  try {
    const branch = await prisma.branch.findUnique({
      where: {
        id: BigInt(normalizedBranchId),
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
      return {
        programs: [],
        error: "Branch not found.",
      };
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
          academicLevels: new Map(),
        };
        programsById.set(programId, program);
      }

      program.academicLevels.set(section.academicLevels.id.toString(), {
        id: section.academicLevels.id.toString(),
        label: section.academicLevels.label,
        slug: section.academicLevels.slug,
      });
    }

    const programOptions = Array.from(programsById.values())
      .toSorted(sortPrograms)
      .map(({ academicLevels, ...program }) => ({
        ...program,
        academicLevels: Array.from(academicLevels.values()).toSorted(
          sortAcademicLevels
        ),
      }));

    return {
      branch: {
        id: branch.id.toString(),
        title: branch.title,
        code: branch.slug,
      },
      programs: programOptions,
    };
  } catch (error) {
    console.error("Failed to fetch admission program options:", error);

    return {
      programs: [],
      error: "Failed to fetch admission program options.",
    };
  }
}

