import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

const CONFIGURED_SECRET_KEY = process.env.SECRET_KEY;

if (!CONFIGURED_SECRET_KEY) {
  throw new Error("SECRET_KEY must be configured for encryption.");
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
  const iv = crypto.randomBytes(12);

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
  const [ivHex, contentHex, tagHex] = encryptedText.split(":");

  if (!ivHex || !contentHex || !tagHex) {
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
