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
  return email.trim().toLowerCase();
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

export function readFormFields<const Fields extends readonly string[]>(
  formData: FormData,
  fields: Fields,
  { trim = true }: { trim?: boolean } = {}
) {
  const read = trim ? readFormText : readFormValue;
  return Object.fromEntries(fields.map((field) => [field, read(formData, field)])) as
    Record<Fields[number], string>;
}