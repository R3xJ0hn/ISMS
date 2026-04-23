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
