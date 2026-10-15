import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { formatAddress, normalizeText } from "@/lib/utils";
import { academicLevelOptions, isAcademicLevelAllowedForProgram } from "@/lib/academic-levels";
import { addressSelect } from "./records";
import type { AdmissionBranchesResult, AdmissionProgramOptionsResult } from "@/lib/types/admission";
import type { ProgramOption } from "@/lib/types/catalog";

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

function sortPrograms(left: ProgramOption, right: ProgramOption) {
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

  const id = /^\d{1,19}$/.test(normalizedBranchId) ? BigInt(normalizedBranchId) : null;

  if (id === null || id <= 0n || id > 9223372036854775807n) {
    return {
      programs: [],
      error: "A valid branchId is required.",
    };
  }

  try {
    const branch = await prisma.branch.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        slug: true,
        title: true,
        branchPrograms: {
          select: {
            program: {
              select: {
                id: true,
                code: true,
                label: true,
                programType: true,
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

    const programsById = new Map<string, ProgramOption>();

    for (const { program } of branch.branchPrograms) {
      const programId = program.id.toString();
      const compatibleLevels = academicLevelOptions
        .filter((level) => isAcademicLevelAllowedForProgram(program.programType, level.value))
        .map((level) => ({ ...level }))
        .toSorted(sortAcademicLevels);

      if (compatibleLevels.length === 0) continue;

      programsById.set(programId, {
        id: programId,
        code: program.code,
        label: program.label,
        programType: program.programType,
        academicLevels: compatibleLevels,
      });
    }

    const programOptions = Array.from(programsById.values())
      .toSorted(sortPrograms);

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

