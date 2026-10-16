import "server-only";

import { CloudinaryUploadError, deleteProfileImage, uploadProfileImage } from "@/lib/cloudinary";
import { prisma } from "@/lib/prisma";
import { validateUserImageFile } from "./image";

export type ProfileImageChange = {
  value: string | null;
  upload?: { secureUrl: string; publicId: string; scope: string };
};
type ProfileImageFailure = { success: false; message: string; fieldErrors: { image: string } };
type ProfileImageResult = { success: true; change?: ProfileImageChange } | ProfileImageFailure;

function failure(message: string): ProfileImageFailure {
  return { success: false, message, fieldErrors: { image: message } };
}

/** Blank inputs preserve an existing image; only a file or explicit removal changes it. */
export function parseProfileImageInput(formData: FormData):
  { success: true; file?: File; remove: boolean } | ProfileImageFailure {
  const images = formData.getAll("image");
  const removals = formData.getAll("removeImage");
  if (images.length > 1 || removals.length > 1 || removals.some((value) => value !== "true")) {
    return failure("Choose one profile photo or remove the existing photo.");
  }
  const image = images[0];
  if (image !== undefined && !(image instanceof File)) return failure("Choose an image file.");
  // React's multipart decoder can rename an unselected file to "undefined".
  // No content means no replacement, regardless of its transported filename.
  const file = image instanceof File && image.size > 0 ? image : undefined;
  const remove = removals.length === 1;
  if (file && remove) return failure("Choose a new photo or remove the current photo, then save.");
  if (file) {
    const error = validateUserImageFile(file);
    if (error) return failure(error);
  }
  return { success: true, ...(file ? { file } : {}), remove };
}

/** Upload after record authorization and validation, before starting a database transaction. */
export async function prepareProfileImage(formData: FormData, scope: string): Promise<ProfileImageResult> {
  const parsed = parseProfileImageInput(formData);
  if (!parsed.success) return parsed;
  if (!parsed.file) return { success: true, ...(parsed.remove ? { change: { value: null } } : {}) };
  try {
    const upload = await uploadProfileImage(parsed.file, scope);
    return { success: true, change: { value: upload.secureUrl, upload: { ...upload, scope } } };
  } catch (error) {
    return failure(error instanceof CloudinaryUploadError ? error.message : "Unable to upload this photo. Please try again.");
  }
}

/** A lost connection may conceal a committed save: delete only a confirmed unused new upload. */
export async function cleanupProfileImage(change: ProfileImageChange | undefined): Promise<void> {
  const upload = change?.upload;
  if (!upload) return;
  try {
    const matches = await Promise.all([
      prisma.user.findFirst({ where: { userImage: upload.secureUrl }, select: { id: true } }),
      prisma.employee.findFirst({ where: { userImage: upload.secureUrl }, select: { id: true } }),
      prisma.student.findFirst({ where: { userImage: upload.secureUrl }, select: { id: true } }),
    ]);
    if (matches.some(Boolean)) return;
    await deleteProfileImage(upload.publicId, upload.scope);
  } catch { /* Preserve the asset if its use is uncertain, and keep the original save error. */ }
}
