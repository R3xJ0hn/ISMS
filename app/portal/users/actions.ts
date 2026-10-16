"use server";

import { updateUserImage, type UserImageFormState } from "@/lib/users/admin";

export async function updateUserImageAction(previousState: UserImageFormState, formData: FormData): Promise<UserImageFormState> {
  return updateUserImage(previousState, formData);
}
