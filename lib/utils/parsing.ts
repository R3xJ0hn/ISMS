export function parseId(value: string) {
  if (!/^\d+$/.test(value)) return null;

  return BigInt(value);
}

export function parseDateInput(value: string) {
  const parts = value.split("-");

  if (parts.length !== 3) {
    throw new Error("Invalid date value.");
  }

  const [yearText, monthText, dayText] = parts;

  const isValidDateFormat =
    /^\d{4}$/.test(yearText) &&
    /^\d{2}$/.test(monthText) &&
    /^\d{2}$/.test(dayText);

  if (!isValidDateFormat) {
    throw new Error("Invalid date value.");
  }

  const year = Number.parseInt(yearText, 10);
  const month = Number.parseInt(monthText, 10);
  const day = Number.parseInt(dayText, 10);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new Error("Invalid date value.");
  }

  const date = new Date(Date.UTC(year, month - 1, day));

  const isRealDate =
    !Number.isNaN(date.getTime()) &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day;

  if (!isRealDate) {
    throw new Error("Invalid date value.");
  }

  return date;
}
