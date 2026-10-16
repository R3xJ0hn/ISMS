import type { Prisma } from "@/lib/generated/prisma/client";
import { formatStudentName } from "@/lib/utils";

export const classStudentPreviewLimit = 4;

export type ClassStudentPreview = { id: string; name: string; imageUrl: string | null };

// Class cards need only a few display profiles, even when a class has a large roster.
export const classStudentPreviewSelection = {
  students: {
    take: classStudentPreviewLimit,
    orderBy: [
      { student: { lastName: "asc" } },
      { student: { firstName: "asc" } },
      { studentId: "asc" },
    ],
    select: { student: { select: {
      id: true, firstName: true, middleName: true, lastName: true, suffix: true, userImage: true,
    } } },
  },
  _count: { select: { students: true } },
} satisfies Prisma.ClassSelect;

type PreviewMembership = Prisma.ClassGetPayload<{ select: typeof classStudentPreviewSelection }>["students"][number];

export function serializeClassStudentPreviews(students: readonly PreviewMembership[]): ClassStudentPreview[] {
  return students.slice(0, classStudentPreviewLimit).map(({ student }) => ({
    id: student.id.toString(),
    name: formatStudentName(student),
    imageUrl: student.userImage,
  }));
}
