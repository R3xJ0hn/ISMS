import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProgramOption = {
  id: string;
  code: string;
  label: string;
  programType: string;
  academicLevels: Map<
    string,
    {
      id: string;
      label: string;
      slug: string;
    }
  >;
};

type BranchSummary = {
  id: string;
  title: string;
  code: string;
};

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

export async function GET(request: NextRequest) {
  const branchId = request.nextUrl.searchParams.get("branchId")?.trim() ?? "";

  if (!/^\d+$/.test(branchId)) {
    return NextResponse.json(
      {
        error: "A valid branchId query parameter is required.",
      },
      { status: 400 }
    );
  }

  try {
    const [branch, sections] = await Promise.all([
      prisma.branch.findUnique({
        where: {
          id: BigInt(branchId),
        },
        select: {
          id: true,
          slug: true,
          title: true,
        },
      }),
      prisma.section.findMany({
        where: {
          branchId: BigInt(branchId),
        },
        select: {
          academicLevels: {
            select: {
              id: true,
              label: true,
              slug: true,
            },
          },
          program: {
            select: {
              id: true,
              code: true,
              label: true,
              programType: true,
            },
          },
        },
      }),
    ]);

    if (!branch) {
      return NextResponse.json(
        {
          error: "Branch not found.",
        },
        { status: 404 }
      );
    }

    const programsById = new Map<string, ProgramOption>();

    for (const section of sections) {
      const programId = section.program.id.toString();
      const existingProgram = programsById.get(programId);

      if (existingProgram) {
        existingProgram.academicLevels.set(section.academicLevels.id.toString(), {
          id: section.academicLevels.id.toString(),
          label: section.academicLevels.label,
          slug: section.academicLevels.slug,
        });
        continue;
      }

      programsById.set(programId, {
        id: programId,
        code: section.program.code,
        label: section.program.label,
        programType: section.program.programType,
        academicLevels: new Map([
          [
            section.academicLevels.id.toString(),
            {
              id: section.academicLevels.id.toString(),
              label: section.academicLevels.label,
              slug: section.academicLevels.slug,
            },
          ],
        ]),
      });
    }

    const programs = Array.from(programsById.values())
      .toSorted(sortPrograms)
      .map(({ academicLevels, ...program }) => ({
        ...program,
        academicLevels: Array.from(academicLevels.values()).toSorted(
          sortAcademicLevels
        ),
      }));

    const branchSummary: BranchSummary = {
      id: branch.id.toString(),
      title: branch.title,
      code: branch.slug,
    };

    return NextResponse.json({
      branch: branchSummary,
      programs,
    });
  } catch (error) {
    console.error("Failed to fetch admission program options:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch admission program options.",
      },
      { status: 500 }
    );
  }
}
