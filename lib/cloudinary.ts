import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { userImageMaxBytes, userImageMimeTypes } from "@/lib/users/image";

const requestTimeoutMs = 20_000;
const configurationError = "Profile image uploads are not configured. Contact your administrator.";
const unavailableError = "Photo uploads are unavailable. Ask an administrator to check the Cloudinary configuration.";
const uploadError = "The profile image could not be uploaded. Please try again.";
const cleanupError = "The unused profile image could not be removed.";
const imageTypeError = "Choose a JPEG, PNG, or WebP image.";

type CloudinaryConfiguration = { cloudName: string; apiKey: string; apiSecret: string };
export type UploadedProfileImage = { secureUrl: string; publicId: string };

/** Only safe, actionable messages intended for the portal form. */
export class CloudinaryUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CloudinaryUploadError";
  }
}

function getConfiguration(): CloudinaryConfiguration {
  let cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  let apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  let apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

  if (process.env.CLOUDINARY_URL?.trim()) {
    try {
      const url = new URL(process.env.CLOUDINARY_URL.trim());
      if (url.protocol !== "cloudinary:" || url.port || url.search || url.hash || (url.pathname && url.pathname !== "/")) {
        throw new Error();
      }
      cloudName = url.hostname;
      apiKey = decodeURIComponent(url.username);
      apiSecret = decodeURIComponent(url.password);
    } catch {
      throw new CloudinaryUploadError(configurationError);
    }
  }

  if (!cloudName || !/^[a-zA-Z0-9_-]+$/.test(cloudName) || !apiKey || !apiSecret || /[\s\u0000-\u001f\u007f]/.test(apiKey + apiSecret)) {
    throw new CloudinaryUploadError(configurationError);
  }
  return { cloudName, apiKey, apiSecret };
}

function getUserImagePrefix(userId: string) {
  if (typeof userId !== "string" || !userId || userId !== userId.trim() || userId.length > 256) {
    throw new CloudinaryUploadError("A valid user is required to upload a profile image.");
  }
  const userHash = createHash("sha256").update(userId).digest("hex");
  return `isms/profile-images/${userHash}/`;
}

async function validateImage(file: File) {
  if (!(file instanceof File) || file.size === 0 || !(userImageMimeTypes as readonly string[]).includes(file.type)) {
    throw new CloudinaryUploadError(imageTypeError);
  }
  if (file.size > userImageMaxBytes) throw new CloudinaryUploadError("The profile image must be 5 MB or smaller.");

  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte);
  const isWebp = bytes.length >= 12 && [0x52, 0x49, 0x46, 0x46].every((byte, index) => bytes[index] === byte)
    && [0x57, 0x45, 0x42, 0x50].every((byte, index) => bytes[index + 8] === byte);
  const expectedMime = isJpeg ? "image/jpeg" : isPng ? "image/png" : isWebp ? "image/webp" : null;
  if (!expectedMime || file.type !== expectedMime) throw new CloudinaryUploadError(imageTypeError);
}

function signedForm(configuration: CloudinaryConfiguration, parameters: Record<string, string>) {
  const fields = { ...parameters, timestamp: Math.floor(Date.now() / 1000).toString() };
  // Cloudinary signs the sorted, unescaped name=value pairs, followed by the secret.
  // file and api_key are excluded from the signature, and the secret never leaves this server.
  const serialized = Object.entries(fields).sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`).join("&");
  const signature = createHash("sha256").update(serialized + configuration.apiSecret).digest("hex");
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  form.set("api_key", configuration.apiKey);
  form.set("signature", signature);
  return form;
}

async function request(configuration: CloudinaryConfiguration, operation: "upload" | "destroy", form: FormData) {
  const response = await fetch(`https://api.cloudinary.com/v1_1/${configuration.cloudName}/image/${operation}`, {
    method: "POST", body: form, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(requestTimeoutMs),
  });
  if (operation === "upload" && (response.status === 401 || response.status === 403)) {
    throw new CloudinaryUploadError(unavailableError);
  }
  if (!response.ok) throw new Error();
  const result: unknown = await response.json();
  if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error();
  return result as Record<string, unknown>;
}

/** Call only after the server has authorized access to the target user. */
export async function uploadProfileImage(file: File, userId: string): Promise<UploadedProfileImage> {
  await validateImage(file);
  const prefix = getUserImagePrefix(userId);
  const configuration = getConfiguration();
  const publicId = prefix + randomUUID();
  const form = signedForm(configuration, { public_id: publicId, overwrite: "false", allowed_formats: "jpg,jpeg,png,webp" });
  // Ignore user-supplied filenames; the actual format is checked locally and by Cloudinary.
  form.set("file", file, "profile-image");

  try {
    const result = await request(configuration, "upload", form);
    if (result.public_id !== publicId || result.resource_type !== "image" || result.type !== "upload"
      || typeof result.version !== "number" || !Number.isSafeInteger(result.version) || result.version <= 0
      || typeof result.format !== "string" || !["jpg", "jpeg", "png", "webp"].includes(result.format)
      || typeof result.secure_url !== "string") throw new Error();

    const secureUrl = new URL(result.secure_url);
    const expectedPath = `/${configuration.cloudName}/image/upload/v${result.version}/${publicId}.${result.format}`;
    if (secureUrl.origin !== "https://res.cloudinary.com" || secureUrl.username || secureUrl.password
      || secureUrl.search || secureUrl.hash || secureUrl.pathname !== expectedPath) throw new Error();
    return { secureUrl: secureUrl.href, publicId };
  } catch (error) {
    // Provider bodies and network errors may contain configuration details. Return only a safe message.
    if (error instanceof CloudinaryUploadError) throw error;
    throw new CloudinaryUploadError(uploadError);
  }
}

/** Roll back only an app-generated upload belonging to this user, never a supplied URL. */
export async function deleteProfileImage(publicId: string, userId: string): Promise<void> {
  const prefix = getUserImagePrefix(userId);
  const uuid = typeof publicId === "string" && publicId.startsWith(prefix) ? publicId.slice(prefix.length) : "";
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(uuid)) {
    throw new CloudinaryUploadError(cleanupError);
  }
  const configuration = getConfiguration();
  const form = signedForm(configuration, { public_id: publicId, invalidate: "true" });
  try {
    const result = await request(configuration, "destroy", form);
    if (result.result !== "ok" && result.result !== "not found") throw new Error();
  } catch {
    throw new CloudinaryUploadError(cleanupError);
  }
}
