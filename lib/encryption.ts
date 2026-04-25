import crypto from "crypto";

const ALGORITHM = "aes-256-cbc";

const SECRET_KEY = process.env.SECRET_KEY || "12345678901234567890123456789012";

function getEncryptionKey() {
  const key = Buffer.from(SECRET_KEY, "utf8");

  if (key.length === 32) {
    return key;
  }

  return crypto.createHash("sha256").update(SECRET_KEY).digest();
}

export function encrypt(text: string) {
  const iv = crypto.randomBytes(16); // random IV

  const cipher = crypto.createCipheriv(
    ALGORITHM,
    getEncryptionKey(),
    iv
  );

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  return iv.toString("hex") + ":" + encrypted;
}

export function decrypt(encryptedText: string) {
  const [ivHex, content] = encryptedText.split(":");

  if (!ivHex || !content) {
    throw new Error("Invalid encrypted text format.");
  }

  const iv = Buffer.from(ivHex, "hex");

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    iv
  );

  let decrypted = decipher.update(content, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
