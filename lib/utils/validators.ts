import { emailPattern, phonePattern, schoolYearPattern } from "./patterns";

export function validateEmail(value: string) {
  return isValidEmail(value);
}

export function isValidEmail(value: string) {
  return emailPattern.test(value.trim());
}

export function validatePhone(value: string) {
  return isValidPhone(value);
}

export function isValidPhone(value: string) {
  const normalized = value.trim();

  if (!phonePattern.test(normalized)) return false;

  const digits = normalized.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

export function validateSchoolYear(value: string) {
  const match = schoolYearPattern.exec(value.trim());

  if (!match) return false;

  const startYear = Number.parseInt(match[1], 10);
  const endYear = match[2] ? Number.parseInt(match[2], 10) : null;

  if (Number.isNaN(startYear) || startYear < 1900 || startYear > 2100) {
    return false;
  }

  if (endYear === null) return true;

  return endYear === startYear + 1;
}

export function isEnumIncludes<T extends Record<string, string>>(
  values: T,
  value: string,
) {
  return Object.values(values).includes(value);
}
