const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[+]?[\d\s()\-]{7,20}$/;
const schoolYearPattern = /^(\d{4})(?:\s*-\s*(\d{4}))?$/;

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
