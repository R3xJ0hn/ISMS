export const userImageMaxBytes = 5 * 1024 * 1024;
export const userImageMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;

export function validateUserImageFile(file: { type: string; size: number }): string | null {
  if (!(userImageMimeTypes as readonly string[]).includes(file.type)) return "Choose a JPEG, PNG, or WebP image.";
  if (file.size === 0 || file.size > userImageMaxBytes) return "Choose an image between 1 byte and 5 MB.";
  return null;
}
