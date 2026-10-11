const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[+]?[\d\s()\-]{7,20}$/;
const schoolYearPattern = /^(\d{4})(?:\s*-\s*(\d{4}))?$/;

export function parseId(value: string) {
  return /^\d+$/.test(value) ? BigInt(value) : null;
}

export function readFormText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function readFormFields<const Fields extends readonly string[]>(formData: FormData, fields: Fields) {
  return Object.fromEntries(fields.map((field) => [field, readFormText(formData, field)])) as
    Record<Fields[number], string>;
}

export function enumIncludes<T extends Record<string, string>>(values: T, value: string): value is T[keyof T] {
  return Object.values(values).includes(value);
}

export function optionalText(value: string) {
  return value || null;
}

export function parseDateInput(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
    ? date
    : null;
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
