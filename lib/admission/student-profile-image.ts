import "server-only";

import { prisma } from "@/lib/prisma";
import { getUserForProfile, ProfileIdentityError } from "@/lib/users/profiles";

/** Preserve photos from Manage Users until a student-specific photo is saved. */
export async function getStudentProfileImage(student: { id: bigint; userImage?: string | null }) {
  if (student.userImage) return student.userImage;
  try {
    return (await getUserForProfile(prisma, { kind: "student", id: student.id }))?.userImage ?? null;
  } catch (error) {
    if (error instanceof ProfileIdentityError) return null;
    throw error;
  }
}
