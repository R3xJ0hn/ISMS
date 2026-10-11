import { scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { promisify } from "node:util";
import { compare, hash } from "bcryptjs";

export const passwordHashDefaults = {
  algorithm: "bcrypt",
  rounds: 12,
  legacyScrypt: { keyLength: 64, cost: 16384, blockSize: 8, parallelization: 1 },
} as const;

const DUMMY_PASSWORD_HASH =
  "$2b$12$w0LkwL5Dj1mh2EDkETZjS.uYL2Z1vq5Wm1QX/YTDtzG3wNAvWo6N6";
const scrypt = promisify(scryptCallback) as (
  password: string, salt: Buffer, keyLength: number, options: ScryptOptions
) => Promise<Buffer>;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isBcryptHash(value: string) {
  return /^\$2[aby]\$/.test(value);
}

function parseStrictInteger(value: string) {
  const parsed = /^\d+$/.test(value) ? Number.parseInt(value, 10) : NaN;
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : null;
}

async function verifyLegacyScryptHash(password: string, storedHash: string) {
  const [algorithm, costText, blockSizeText, parallelizationText, saltHex, derivedKeyHex] =
    storedHash.split("$");

  if (algorithm !== "scrypt" || !costText || !blockSizeText ||
      !parallelizationText || !saltHex || !derivedKeyHex) {
    return false;
  }

  const cost = parseStrictInteger(costText);
  const blockSize = parseStrictInteger(blockSizeText);
  const parallelization = parseStrictInteger(parallelizationText);
  if (cost === null || blockSize === null || parallelization === null) return false;

  const expectedKey = Buffer.from(derivedKeyHex, "hex");
  const actualKey = await scrypt(password, Buffer.from(saltHex, "hex"), expectedKey.length, {
    N: cost, r: blockSize, p: parallelization, maxmem: 32 * 1024 * 1024,
  });
  return timingSafeEqual(actualKey, expectedKey);
}

export async function verifyPassword(password: string, storedHash = DUMMY_PASSWORD_HASH) {
  return isBcryptHash(storedHash)
    ? compare(password, storedHash)
    : verifyLegacyScryptHash(password, storedHash);
}

export async function hashPassword(password: string) {
  return hash(password, passwordHashDefaults.rounds);
}
