import { capitalizeInputText, normalizeEmail, readFormValue, sanitizeInputText } from "@/lib/utils";
import { validateEmail, validatePhone } from "@/lib/validation";
import type { PublicSiteSettings } from "./defaults";

export type SiteSettingsFormState = {
  success: boolean;
  message: string;
  fieldErrors?: Partial<Record<keyof PublicSiteSettings, string>>;
};

export const siteSettingsLimits = {
  aboutTitle: 200,
  aboutIntro: 10000,
  mission: 10000,
  vision: 10000,
  contactIntro: 2000,
  contactEmail: 320,
  contactPhone: 30,
  contactAddress: 2000,
  officeHours: 1000,
  mapUrl: 2048,
  facebookUrl: 2048,
  officialWebsiteUrl: 2048,
} as const;

/** Safe external destinations; preserve case-sensitive paths and query values. */
export function safeExternalUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  const text = value.trim();
  if (!/^https?:\/\/[^/]/i.test(text) || /[\u0000-\u0020\u007F-\u009F<>\\]/.test(text) || /\p{Cf}/u.test(text)) return "";
  try {
    const url = new URL(text);
    return (url.protocol === "https:" || url.protocol === "http:") &&
      !!url.hostname && !url.username && !url.password ? url.href : "";
  } catch {
    return "";
  }
}

function humanText(value: unknown, multiline = true) {
  const text = sanitizeInputText(value, { preserveLineBreaks: multiline });
  return multiline ? text.split("\n").map(capitalizeInputText).join("\n") : capitalizeInputText(text);
}

function validateText(
  data: Partial<PublicSiteSettings>,
  required: readonly (keyof PublicSiteSettings)[],
) {
  const fieldErrors: NonNullable<SiteSettingsFormState["fieldErrors"]> = {};
  for (const [field, value] of Object.entries(data) as [keyof PublicSiteSettings, string][]) {
    if (required.includes(field) && !value) fieldErrors[field] = "Enter a value for this field.";
    else if (value.length > siteSettingsLimits[field]) fieldErrors[field] = `Use ${siteSettingsLimits[field]} characters or fewer.`;
  }
  return fieldErrors;
}

function failure(fieldErrors: NonNullable<SiteSettingsFormState["fieldErrors"]>) {
  return { success: false as const, message: "Check the highlighted fields.", fieldErrors };
}

export function parseAboutSettings(formData: FormData) {
  const data = {
    aboutTitle: humanText(readFormValue(formData, "aboutTitle"), false),
    aboutIntro: humanText(readFormValue(formData, "aboutIntro")),
    mission: humanText(readFormValue(formData, "mission")),
    vision: humanText(readFormValue(formData, "vision")),
  };
  const fieldErrors = validateText(data, ["aboutTitle", "aboutIntro"]);
  return Object.keys(fieldErrors).length ? failure(fieldErrors) : { success: true as const, data };
}

export function parseContactSettings(formData: FormData) {
  const data = {
    contactIntro: humanText(readFormValue(formData, "contactIntro")),
    contactEmail: normalizeEmail(readFormValue(formData, "contactEmail")),
    contactPhone: sanitizeInputText(readFormValue(formData, "contactPhone")),
    contactAddress: humanText(readFormValue(formData, "contactAddress")),
    officeHours: humanText(readFormValue(formData, "officeHours")),
    mapUrl: readFormValue(formData, "mapUrl").trim(),
    facebookUrl: readFormValue(formData, "facebookUrl").trim(),
    officialWebsiteUrl: readFormValue(formData, "officialWebsiteUrl").trim(),
  };
  const fieldErrors = validateText(data, ["contactEmail", "contactPhone", "contactAddress"]);
  if (data.contactEmail && !validateEmail(data.contactEmail)) fieldErrors.contactEmail = "Enter a valid email address.";
  if (data.contactPhone && !validatePhone(data.contactPhone)) fieldErrors.contactPhone = "Enter a valid contact number, including the area code when needed.";
  for (const field of ["mapUrl", "facebookUrl", "officialWebsiteUrl"] as const) {
    if (!data[field]) continue;
    const url = safeExternalUrl(data[field]);
    if (!url) fieldErrors[field] = "Enter a complete http:// or https:// URL without a username or password.";
    else {
      data[field] = url;
      if (url.length > siteSettingsLimits[field]) fieldErrors[field] = `Use ${siteSettingsLimits[field]} characters or fewer.`;
    }
  }
  return Object.keys(fieldErrors).length ? failure(fieldErrors) : { success: true as const, data };
}
