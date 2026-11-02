import "server-only";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import { literalInsensitiveEquality, parseRecordId } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { parseScheme, type SchemeState } from "./validation";

export async function getAcademicSchemes() {
  await requireSuperAdmin();
  const schemes = await prisma.academicScheme.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { programs: true } },
      terms: {
        orderBy: { position: "asc" },
        include: {
          _count: { select: { classes: true } },
          periods: {
            orderBy: { position: "asc" },
            include: { _count: { select: { classes: true } } },
          },
        },
      },
    },
  });
  return schemes.map((scheme) => ({
    id: String(scheme.id),
    name: scheme.name,
    revision: scheme.revision,
    programCount: scheme._count.programs,
    inUse:
      scheme.legacySpreadsheet ||
      scheme._count.programs > 0 ||
      scheme.terms.some(
        (term) =>
          term._count.classes > 0 ||
          term.periods.some((period) => period._count.classes > 0),
      ),
    terms: scheme.terms.map((term) => ({
      name: term.name,
      averageColumn: term.averageColumn,
      equivalentColumn: term.equivalentColumn,
      periods: term.periods.map((period) => ({
        name: period.name,
        worksheetName: period.worksheetName,
        reportColumn: period.reportColumn,
      })),
    })),
  }));
}

export async function getProgramAcademicDefaults() {
  await requireSuperAdmin();
  const programs = await prisma.program.findMany({
    orderBy: { code: "asc" },
    select: { id: true, code: true, label: true, academicSchemeId: true },
  });
  return programs.map((program) => ({
    id: String(program.id),
    name: `${program.code} — ${program.label}`,
    schemeId: program.academicSchemeId ? String(program.academicSchemeId) : "",
  }));
}

export async function assignProgramScheme(
  _previous: SchemeState,
  form: FormData,
): Promise<SchemeState> {
  await requireSuperAdmin();
  const programId = parseRecordId(String(form.get("programId") ?? "")),
    schemeId = parseRecordId(String(form.get("schemeId") ?? ""));
  if (!programId || !schemeId)
    return {
      success: false,
      message: "Choose a program and an academic scheme.",
    };
  try {
    const result = await prisma.$transaction(
      async (tx) => {
        if (
          !(await tx.academicScheme.findUnique({
            where: { id: schemeId },
            select: { id: true },
          }))
        )
          return { success: false, message: "Choose an existing scheme." };
        if (
          !(await tx.program.findUnique({
            where: { id: programId },
            select: { id: true },
          }))
        )
          return { success: false, message: "Choose an existing program." };
        await tx.program.update({
          where: { id: programId },
          data: { academicSchemeId: schemeId },
        });
        return {
          success: true,
          message:
            "Program calendar updated. Existing classes retain their assigned terms.",
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    if (result.success)
      for (const path of [
        "/portal/academic-terms",
        "/portal/classes/new",
        "/portal/classes",
      ])
        revalidatePath(path);
    return result;
  } catch {
    return {
      success: false,
      message: "Unable to assign the academic scheme. Refresh and try again.",
    };
  }
}

export async function saveAcademicScheme(
  _previous: SchemeState,
  form: FormData,
): Promise<SchemeState> {
  await requireSuperAdmin();
  const raw = form.get("values");
  if (typeof raw !== "string" || raw.length > 60000)
    return {
      success: false,
      message: "The academic setup is invalid or too large.",
    };
  let values: unknown;
  try {
    values = JSON.parse(raw);
  } catch {
    return {
      success: false,
      message: "Check the academic setup and try again.",
    };
  }
  const parsed = parseScheme(values);
  if (!parsed.success) return parsed;
  const rawId = form.get("schemeId");
  const id = typeof rawId === "string" ? parseRecordId(rawId) : null;
  if (rawId !== null && id === null)
    return { success: false, message: "Choose a valid academic scheme." };
  const revision = Number(form.get("revision"));
  if (id !== null && (!Number.isSafeInteger(revision) || revision < 1))
    return { success: false, message: "Refresh this scheme before editing." };
  try {
    const result = await prisma.$transaction(
      async (tx) => {
        if (id !== null) {
          const existing = await tx.academicScheme.findUnique({
            where: { id },
            select: {
              revision: true,
              legacySpreadsheet: true,
              programs: { select: { id: true }, take: 1 },
              terms: {
                select: {
                  classes: { select: { id: true }, take: 1 },
                  periods: {
                    select: { classes: { select: { classId: true }, take: 1 } },
                  },
                },
              },
            },
          });
          if (!existing || existing.revision !== revision)
            return {
              success: false,
              message:
                "This scheme changed or was removed. Refresh before editing.",
            };
          if (
            existing.legacySpreadsheet ||
            existing.programs.length ||
            existing.terms.some(
              (term) =>
                term.classes.length ||
                term.periods.some((period) => period.classes.length),
            )
          ) {
            return {
              success: false,
              message:
                "This scheme is in use. Duplicate it to create a new version instead.",
            };
          }
        }
        const duplicate = await tx.academicScheme.findFirst({
          where: {
            name: literalInsensitiveEquality(parsed.values.name),
            ...(id === null ? {} : { id: { not: id } }),
          },
          select: { id: true },
        });
        if (duplicate)
          return {
            success: false,
            message: "An academic scheme already uses this name.",
          };
        const terms = parsed.values.terms.map((term, index) => ({
          name: term.name,
          position: index + 1,
          averageColumn: term.averageColumn,
          equivalentColumn: term.equivalentColumn,
          periods: {
            create: term.periods.map((period, periodIndex) => ({
              ...period,
              key: `period_${periodIndex + 1}`,
              position: periodIndex + 1,
            })),
          },
        }));
        if (id === null)
          await tx.academicScheme.create({
            data: { name: parsed.values.name, terms: { create: terms } },
          });
        else {
          await tx.academicTerm.deleteMany({ where: { schemeId: id } });
          await tx.academicScheme.update({
            where: { id },
            data: {
              name: parsed.values.name,
              revision: { increment: 1 },
              terms: { create: terms },
            },
          });
        }
        return { success: true, message: "Academic scheme saved." };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    if (result.success) revalidatePath("/portal/academic-terms");
    return result;
  } catch (error) {
    const conflict =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ["P2002", "P2034", "P2003"].includes(error.code);
    return {
      success: false,
      message: conflict
        ? "The setup changed or its name is already used. Refresh and try again."
        : "Unable to save academic terms. Please try again.",
    };
  }
}
