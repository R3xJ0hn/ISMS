import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Address } from "@/lib/types/catalog";
import { parseDateInput } from "./validation";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

export function normalizeEmail(email: string) {
  return sanitizeInputText(email).toLowerCase();
}

function stripInputMarkup(value: string) {
  const parts: string[] = [];
  let previousEnd = 0;
  let excludedTag: string | null = null;
  for (const match of value.matchAll(/<[^<>]*>/g)) {
    if (!excludedTag) parts.push(value.slice(previousEnd, match.index), " ");
    const tag = /^<\s*(\/?)\s*(script|style|iframe|object)\b/i.exec(match[0]);
    if (tag) {
      const name = tag[2].toLowerCase();
      if (!tag[1] && !excludedTag) excludedTag = name;
      else if (tag[1] && excludedTag === name) excludedTag = null;
    }
    previousEnd = match.index + match[0].length;
  }
  if (!excludedTag) parts.push(value.slice(previousEnd));
  return parts.join("").replace(/[<>]/g, "");
}

/** Plain text for user-entered database fields; credentials and signed values stay raw. */
export function sanitizeInputText(value: unknown, { preserveLineBreaks = false }: { preserveLineBreaks?: boolean } = {}) {
  if (typeof value !== "string") return "";
  const normalized = value.normalize("NFC").replace(/\r\n?/g, "\n")
    .replace(preserveLineBreaks ? /[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/g : /[\u0000-\u001F\u007F-\u009F]/g, " ")
    .replace(/\p{Cf}/gu, "")
    .replace(/<!--[\s\S]*?(?:-->|$)/g, " ");
  const text = stripInputMarkup(normalized);
  return preserveLineBreaks
    ? text.split("\n").map((line) => line.replace(/\s+/gu, " ").trim()).join("\n").trim()
    : text.replace(/\s+/gu, " ").trim();
}

/** Capitalize word initials without losing acronyms or intentional internal capitalization. */
export function capitalizeInputText(value: unknown) {
  return sanitizeInputText(value).replace(/(^|[^\p{L}\p{M}])([\p{L}])/gu,
    (_match, prefix: string, letter: string) => prefix + letter.toUpperCase());
}

export function normalizeName(value: unknown) {
  return normalizeText(value).replace(/\s+/g, " ")
}

export function normalizeKey(key: string) {
  return key.toLowerCase().replace(/[\s_-]+/g, "");
}

export function normalizeHeader(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function sanitizeText(value: string) {
  return value.replace(/[\u0000-\u001F\u007F]/g, " ").trim();
}

export function hasValue(value: unknown) {
  return value !== undefined && value !== null && value !== "";
}

export function stringifyNullable(value: unknown) {
  return value === null || value === undefined ? null : String(value).trim() || null;
}

export function optionalValue(value: string | null | undefined) {
  return value ?? "";
}

export function getRecordValue(record: Record<string, unknown>, keys: readonly string[]) {
  const entries = Object.entries(record);
  for (const key of keys) {
    if (hasValue(record[key])) return record[key];
    const normalizedKey = normalizeKey(key);
    const match = entries.find(([entryKey, value]) => hasValue(value) && normalizeKey(entryKey) === normalizedKey);
    if (match) return match[1];
  }
  return null;
}

/** Object records include arrays, matching the grades service payload contract. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseId(value: string) {
  return /^\d+$/.test(value) ? BigInt(value) : null;
}

/** Positive PostgreSQL bigint IDs. Signed-token callers can require canonical digits. */
export function parseRecordId(value: string, { canonical = false, maxDigits }: {
  canonical?: boolean;
  maxDigits?: number;
} = {}) {
  if ((maxDigits !== undefined && value.length > maxDigits) ||
      (canonical && !/^[1-9]\d*$/.test(value))) return null;
  const id = parseId(value);
  return id !== null && id > 0n && id <= 9223372036854775807n ? id : null;
}

/** Prisma's PostgreSQL insensitive equality uses ILIKE, whose wildcards must be escaped. */
export function literalInsensitiveEquality(value: string) {
  return { equals: value.replace(/[\\%_]/g, (character) => `\\${character}`), mode: "insensitive" as const };
}

export function parsePositiveSafeInteger(value: string) {
  const parsed = /^\d+$/.test(value) ? Number.parseInt(value, 10) : NaN;
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : null;
}

export function enumIncludes<T extends Record<string, string>>(values: T, value: string): value is T[keyof T] {
  return Object.values(values).includes(value);
}

export function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function toTitleCase(value: string) {
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}

export function formatRoleLabel(role: string) {
  return role.replace(/([A-Z])/g, " $1").replace(/^./, (value) => value.toUpperCase());
}

export function getEmailDisplayName(email: string, fallbackLabel: string) {
  const emailName = email.split("@")[0]?.trim() ?? "";
  const name = emailName.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[._-]+/g, " ").trim();
  if (!name || name.replace(/\s+/g, "").toLowerCase() === fallbackLabel.replace(/\s+/g, "").toLowerCase()) {
    return fallbackLabel;
  }
  return toTitleCase(name.toLowerCase());
}

export function getInitials(name: string, fallback = "U") {
  const words = name.split(/\s+/).filter(Boolean);
  if (!words.length) return fallback;
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
}

const programTypeLabels: Record<string, string> = {
  Bachelor: "Bachelor's Degree", SeniorHigh: "Senior High School", Associate: "Associate Degree",
};

export function formatProgramType(programType: string) {
  return Object.hasOwn(programTypeLabels, programType) ? programTypeLabels[programType] : programType;
}

export function getDeviceLabel(userAgent: string | null) {
  if (!userAgent) return "Unknown device";
  if (/iphone|ipad|android|mobile/i.test(userAgent)) return "Mobile browser";
  if (/windows|macintosh|linux/i.test(userAgent)) return "Desktop browser";
  return "Browser";
}

export function optionalText(value: string) {
  return value || null;
}

/** Optional input text: blank or N/A (any capitalization) means no value. */
export function nullableInputText(value: unknown): string | null {
  const text = sanitizeInputText(value);
  return !text || /^n\/a$/i.test(text) ? null : text;
}

const htmlEntities: Record<string, string> = {
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
};

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => htmlEntities[character]);
}

export function formatStudentName(student: {
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
}) {
  return [student.firstName, student.middleName, student.lastName, student.suffix]
    .filter(Boolean)
    .join(" ");
}

export function formatAddress(address: Address | null) {
  if (!address) return "";
  return [address.houseNumber, address.street, address.subdivision, address.barangay,
    address.city, address.province, address.postalCode].filter(Boolean).join(", ");
}


const dateTimeFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila",
});

const schoolYearFormatter = new Intl.DateTimeFormat("en", {
  year: "numeric", timeZone: "Asia/Manila",
});

/** Latest school years first, with an existing nonblank value appended unchanged when absent. */
export function generateSchoolYears({
  startYear = 1900,
  endYear,
  referenceDate = new Date(),
  selectedValue,
}: {
  startYear?: number;
  endYear?: number;
  referenceDate?: Date;
  selectedValue?: string | null;
} = {}): string[] {
  const finalYear = endYear ?? Math.min(Number(schoolYearFormatter.format(referenceDate)) + 1, 2100);
  if (!Number.isSafeInteger(startYear) || !Number.isSafeInteger(finalYear) ||
      startYear < 1900 || finalYear > 2100 || startYear > finalYear) {
    throw new RangeError("School year bounds must be whole years from 1900 to 2100, with startYear no later than endYear.");
  }

  const schoolYears = Array.from({ length: finalYear - startYear + 1 }, (_, index) => {
    const year = finalYear - index;
    return `${year}-${year + 1}`;
  });
  if (selectedValue?.trim() && !schoolYears.includes(selectedValue)) schoolYears.push(selectedValue);
  return schoolYears;
}

export function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function formatDate(date: Date | null) {
  return date
    ? new Intl.DateTimeFormat("en", {
        month: "short", day: "numeric", year: "numeric",
      }).format(date)
    : "Not recorded";
}

export function formatDateTime(value: Date) {
  return dateTimeFormatter.format(value);
}

export function parseDateRange(value: string) {
  const start = parseDateInput(value);
  if (!start) return null;
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

/** Preserve whitespace for passwords and signed tokens. */
export function readFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export function readFormText(formData: FormData, key: string) {
  return readFormValue(formData, key).trim();
}

/** Assignment forms send one optional empty sentinel so clearing differs from a missing field. */
export function readFormRecordIds(formData: FormData, key: string): bigint[] | null {
  const entries = formData.getAll(key);
  if (!entries.length || entries.length > 1001) return null;
  const ids = new Set<bigint>();
  let hasEmptyEntry = false;
  for (const entry of entries) {
    if (entry === "") {
      if (hasEmptyEntry) return null;
      hasEmptyEntry = true;
      continue;
    }
    const id = typeof entry === "string" ? parseRecordId(entry, { maxDigits: 20 }) : null;
    if (id === null) return null;
    ids.add(id);
  }
  return [...ids];
}

export function readFormFields<const Fields extends readonly string[]>(
  formData: FormData,
  fields: Fields,
  { trim = true }: { trim?: boolean } = {}
) {
  const read = trim ? readFormText : readFormValue;
  return Object.fromEntries(fields.map((field) => [field, read(formData, field)])) as
    Record<Fields[number], string>;
}
