import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import type { UserRole } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { getProfileForUser, getProfilesForUsers, ProfileIdentityError, type Profile, type UserIdentity } from "./profiles";
import { cleanupProfileImage, parseProfileImageInput, prepareProfileImage } from "./profile-image";
import { parseRecordId } from "@/lib/utils";

export type ManagedUser = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  emailVerified: boolean;
  userImage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UserImageFormState = {
  success: boolean;
  message: string;
  fieldErrors?: Partial<Record<"userId" | "image", string>>;
};

const userSelect = {
  id: true, email: true, role: true, emailVerified: true,
  userImage: true, createdAt: true, updatedAt: true,
} as const;
const visibleUserWhere = { role: { not: "superAdmin" as const } };

function serializeUser(user: Omit<ManagedUser, "id" | "name" | "createdAt" | "updatedAt"> & {
  id: bigint; createdAt: Date; updatedAt: Date;
}, profile?: Profile | null): ManagedUser {
  return {
    id: user.id.toString(), email: user.email, name: profile?.name ?? null, role: user.role,
    emailVerified: user.emailVerified, userImage: profile?.userImage ?? user.userImage,
    createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString(),
  };
}

export async function getUsers(): Promise<ManagedUser[]> {
  await requireAdmin();
  const users = await prisma.user.findMany({
    where: visibleUserWhere, select: userSelect, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  const profiles = await getProfilesForUsers(prisma, users);
  return users.map((user) => serializeUser(user, profiles.get(user.id)));
}

export async function getUserForEdit(userId: string): Promise<ManagedUser | null> {
  await requireAdmin();
  const id = parseRecordId(userId, { canonical: true, maxDigits: 19 });
  if (id === null) return null;
  const user = await prisma.user.findFirst({ where: { id, ...visibleUserWhere }, select: userSelect });
  if (!user) return null;
  try { return serializeUser(user, await getProfileForUser(prisma, user)); }
  catch (error) {
    if (error instanceof ProfileIdentityError) return serializeUser(user);
    throw error;
  }
}

function imageError(message: string): UserImageFormState {
  return { success: false, message, fieldErrors: { image: message } };
}

const unavailable: UserImageFormState = {
  success: false, message: "This user account is unavailable. Return to Manage Users and try again.",
  fieldErrors: { userId: "Choose an existing user account." },
};

export async function updateUserImage(_previousState: UserImageFormState, formData: FormData): Promise<UserImageFormState> {
  await requireAdmin();
  const ids = formData.getAll("userId");
  const id = ids.length === 1 && typeof ids[0] === "string"
    ? parseRecordId(ids[0], { canonical: true, maxDigits: 19 }) : null;
  if (id === null) return unavailable;

  const image = parseProfileImageInput(formData);
  if (!image.success) return image;
  const { file, remove } = image;

  let user: UserIdentity | null;
  let profile: Profile | null;
  try {
    user = await prisma.user.findFirst({
      where: { id, ...visibleUserWhere }, select: { id: true, email: true, role: true, userImage: true },
    });
    if (!user) return unavailable;
    if (!file && !remove) return { success: true, message: "User details saved." };
    profile = await getProfileForUser(prisma, user);
  } catch (error) {
    return imageError(error instanceof ProfileIdentityError ? error.message : "Unable to load this user account. Please try again.");
  }
  if (remove && (profile?.userImage ?? user.userImage) === null) return imageError("This account does not have a profile photo to remove.");

  const prepared = await prepareProfileImage(formData, id.toString());
  if (!prepared.success) return prepared;
  const imageChange = prepared.change;
  const nextImage = imageChange?.value ?? null;
  try {
    await prisma.$transaction(async (transaction) => {
      const current = await transaction.user.findFirst({
        where: { id, ...visibleUserWhere }, select: { id: true, email: true, role: true, userImage: true },
      });
      if (!current || current.email !== user.email || current.role !== user.role || current.userImage !== user.userImage) {
        throw new ProfileIdentityError();
      }
      const currentProfile = await getProfileForUser(transaction, current);
      if (currentProfile?.id !== profile?.id || currentProfile?.kind !== profile?.kind || currentProfile?.userImage !== profile?.userImage) {
        throw new ProfileIdentityError();
      }
      const result = await transaction.user.updateMany({
        // The role and email guards also protect against a changed identity during upload.
        where: { id, role: { not: "superAdmin", equals: user.role }, email: user.email, userImage: user.userImage },
        data: { userImage: nextImage },
      });
      if (result.count !== 1) throw new ProfileIdentityError();
      if (currentProfile) {
        const changes = {
          where: { id: currentProfile.id, userImage: currentProfile.userImage }, data: { userImage: nextImage },
        };
        const saved = currentProfile.kind === "employee"
          ? await transaction.employee.updateMany(changes)
          : await transaction.student.updateMany(changes);
        if (saved.count !== 1) throw new ProfileIdentityError();
      }
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    // A dropped connection can conceal a committed write. Keep an asset if its save is uncertain.
    if (imageChange?.upload) {
      try {
        const current = await prisma.user.findUnique({ where: { id }, select: { userImage: true } });
        if (current?.userImage !== imageChange.value) await cleanupProfileImage(imageChange);
      } catch { /* Preserve the uploaded asset when the database cannot confirm its use. */ }
    }
    return imageError(error instanceof ProfileIdentityError ? error.message : "Unable to save this profile photo. Please reload the page and try again.");
  }

  revalidatePath("/portal", "layout");
  return { success: true, message: remove ? "Profile photo removed." : "Profile photo updated." };
}
