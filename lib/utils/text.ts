type FormRecord = Record<string, unknown>;
type TextNormalizer = (value: unknown) => string;

export function sanitizeText(value: string): string {
  return value.replace(/[\u0000-\u001F\u007F]/g, " ").trim();
}

export function normalizeText(value: unknown): string {
  return typeof value === "string" ? sanitizeText(value) : "";
}

export function optionalText(value: string): string | null {
  return value.trim() || null;
}

export function normalizeNullableText(
  value: string | null | undefined,
): string | null {
  return value == null ? null : optionalText(normalizeText(value));
}

export function normalizeName(value: unknown): string {
  return normalizeText(value).replace(/\s+/g, " ");
}

export function normalizeEmail(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

export function normalizeForm<K extends string>(
  form: FormRecord,
  fields: readonly K[],
): Record<K, string> {
  return Object.fromEntries(
    fields.map((field) => [field, normalizeText(form[field])]),
  ) as Record<K, string>;
}

export function normalizeFormWithNormalizers<
  T extends FormRecord,
  K extends keyof T & string,
>(
  form: T,
  normalizers: Record<K, TextNormalizer>,
): Record<K, string> {
  return Object.fromEntries(
    (Object.keys(normalizers) as K[]).map((field) => [
      field,
      normalizers[field](form[field]),
    ]),
  ) as Record<K, string>;
}
export function missingRequiredField(
  form: FormRecord,
  fields: readonly string[],
): string | null {
  return fields.find((field) => !normalizeText(form[field])) ?? null;
}