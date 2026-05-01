import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const phonePattern = /^[+]?[\d\s()\-]{7,20}$/;
export const schoolYearPattern = /^(\d{4})(?:\s*-\s*(\d{4}))?$/;

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function optionalText(value: string) {
  return value ? value : null;
}

export function sanitizeText(value: string) {
  return value.replace(/[\u0000-\u001F\u007F]/g, " ").trim();
}

export function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

export function normalizeNullableText(value: string | null | undefined) {
  if (value == null) {
    return null;
  }

  const normalizedValue = normalizeText(value);

  return normalizedValue || null;
}
export function normalizeName(value: unknown) {
  return normalizeText(value).replace(/\s+/g, " ")
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function parseId(value: string) {
  if (!/^\d+$/.test(value)) {
    return null;
  }

  return BigInt(value);
}

export function parseDateInput(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date value.");
  }

  return date;
}


export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character] ?? character;
  });
}

export function sanitizeHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    const allowHttp = process.env.NODE_ENV === "development";

    if (url.protocol !== "https:" && !(allowHttp && url.protocol === "http:")) {
      throw new Error();
    }

    return url.toString();
  } catch {
    throw new Error("URL is invalid.");
  }
}


export function validateEmail(value: string) {
  const normalized = value.trim();
  return emailPattern.test(normalized);
}

export function validatePhone(value: string) {
  const normalized = value.trim();

  if (!phonePattern.test(normalized)) {
    return false;
  }

  const digits = normalized.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

export function isValidEmail(value: string) {
  return emailPattern.test(value);
}

export function isValidPhone(value: string) {
  if (!phonePattern.test(value)) {
    return false;
  }

  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}


export function validateSchoolYear(value: string) {
  const match = schoolYearPattern.exec(value.trim());

  if (!match) {
    return false;
  }

  const startYear = Number.parseInt(match[1], 10);
  const endYear = match[2] ? Number.parseInt(match[2], 10) : null;

  if (Number.isNaN(startYear) || startYear < 1900 || startYear > 2100) {
    return false;
  }

  if (endYear === null) {
    return true;
  }

  return endYear === startYear + 1;
}

export function formatStudentDisplayName(student: {
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
}) {
  return [
    student.firstName,
    student.middleName,
    student.lastName,
    student.suffix,
  ]
    .filter(Boolean)
    .join(" ");
}

export function normalizeAppBaseUrl(value: string) {
  const url = new URL(value.trim());
  const allowHttp = process.env.NODE_ENV === "development";

  if (url.protocol !== "https:" && !(allowHttp && url.protocol === "http:")) {
    throw new Error("APP_URL must use HTTPS outside development.");
  }

  url.search = "";
  url.hash = "";
  url.pathname = url.pathname.replace(/\/+$/, "");

  return url.toString().replace(/\/$/, "");
}

export function getAppBaseUrl() {
  if (process.env.APP_URL) {
    return normalizeAppBaseUrl(process.env.APP_URL);
  }

  if (process.env.NEXT_PUBLIC_APP_URL) {
    return normalizeAppBaseUrl(process.env.NEXT_PUBLIC_APP_URL);
  }

  if (process.env.VERCEL_URL) {
    return normalizeAppBaseUrl(`https://${process.env.VERCEL_URL}`);
  }

  return normalizeAppBaseUrl("http://localhost:3000");
}