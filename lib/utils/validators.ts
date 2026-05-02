import { emailPattern, phonePattern, schoolYearPattern } from "./patterns";

export function validateEmail(value: string) {
  const normalized = value.trim();
  return emailPattern.test(normalized);
}

export function isValidEmail(value: string) {
  return emailPattern.test(value);
}

export function validatePhone(value: string) {
  const normalized = value.trim();
  return isValidPhone(normalized);
}

export function isValidPhone(value: string) {
  if (!phonePattern.test(value)) return false;

  const digits = value.replace(/\D/g, "");
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

export function enumIncludes<T extends Record<string, string>>(
  values: T,
  value: string,
) {
  return Object.values(values).includes(value);
}
