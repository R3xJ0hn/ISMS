import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

class ProfileIdentityError extends Error {}

/** Existing non-photo service tests must never upload or resolve an unexpected identity. */
export function nonPhotoServiceModules() {
  return {
    "node:crypto": { randomUUID },
    "@/lib/users/profile-image": {
      prepareProfileImage: async (data: FormData) => {
        const images = data.getAll("image");
        assert.ok(images.every((image) => image instanceof File && image.name === "" && image.size === 0), "Unexpected photo upload in a non-photo test");
        assert.equal(data.has("removeImage"), false, "Unexpected photo removal in a non-photo test");
        return { success: true };
      },
      cleanupProfileImage: async (change: unknown) => { assert.equal(change, undefined); },
    },
    "@/lib/users/profiles": {
      ProfileIdentityError,
      getUserForProfile: async () => null,
    },
  };
}
