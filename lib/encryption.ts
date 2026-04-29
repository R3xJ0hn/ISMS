import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 16;
const AUTH_TAG_LENGTH_BYTES = 16;
const MIN_SECRET_BYTES = 32;

const CONFIGURED_SECRET_KEY = process.env.SECRET_KEY;

if (!CONFIGURED_SECRET_KEY) {
  throw new Error("SECRET_KEY must be configured for encryption.");
}

if (Buffer.byteLength(CONFIGURED_SECRET_KEY, "utf8") < MIN_SECRET_BYTES) {
  throw new Error(`SECRET_KEY must be at least ${MIN_SECRET_BYTES} bytes.`);
}

const SECRET_KEY = CONFIGURED_SECRET_KEY;

function getEncryptionKey() {
  const key = Buffer.from(SECRET_KEY, "utf8");

  if (key.length === 32) {
    return key;
  }

  return crypto.createHash("sha256").update(SECRET_KEY).digest();
}

export function encrypt(text: string) {
  const iv = crypto.randomBytes(IV_LENGTH_BYTES);

  const cipher = crypto.createCipheriv(
    ALGORITHM,
    getEncryptionKey(),
    iv
  );

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${encrypted}:${authTag.toString("hex")}`;
}

export function decrypt(encryptedText: string) {
  const parts = encryptedText.split(":");

  if (parts.length !== 3) {
    throw new Error("Invalid encrypted text format.");
  }

  const [ivHex, contentHex, tagHex] = parts;
  const hexPattern = /^[0-9a-f]+$/i;

  if (
    ivHex.length !== IV_LENGTH_BYTES * 2 ||
    tagHex.length !== AUTH_TAG_LENGTH_BYTES * 2 ||
    !hexPattern.test(ivHex) ||
    !hexPattern.test(tagHex) ||
    !contentHex ||
    contentHex.length % 2 !== 0 ||
    !hexPattern.test(contentHex)
  ) {
    throw new Error("Invalid encrypted text format.");
  }

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(tagHex, "hex");

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    iv
  );
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(contentHex, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
