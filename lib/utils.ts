import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

export function normalizeName(value: unknown) {
  return normalizeText(value).replace(/\s+/g, " ")
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

export function formatDate(date: Date | null) {
  return date
    ? new Intl.DateTimeFormat("en", {
        month: "short", day: "numeric", year: "numeric",
      }).format(date)
    : "Not recorded";
}
