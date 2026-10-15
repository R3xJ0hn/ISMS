import { cache } from "react";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_SITE_SETTINGS, type PublicSiteSettings } from "./defaults";
import { parseAboutSettings, parseContactSettings, safeExternalUrl, type SiteSettingsFormState } from "./validation";

const publicSettingsSelect = {
  aboutTitle: true,
  aboutIntro: true,
  mission: true,
  vision: true,
  contactIntro: true,
  contactEmail: true,
  contactPhone: true,
  contactAddress: true,
  officeHours: true,
  mapUrl: true,
  facebookUrl: true,
  officialWebsiteUrl: true,
} as const;

async function readSettings(): Promise<PublicSiteSettings> {
  const settings = await prisma.siteSetting.findUnique({ where: { id: 1 }, select: publicSettingsSelect });
  if (!settings) return { ...DEFAULT_SITE_SETTINGS };
  return {
    ...settings,
    mapUrl: safeExternalUrl(settings.mapUrl),
    facebookUrl: safeExternalUrl(settings.facebookUrl),
    officialWebsiteUrl: safeExternalUrl(settings.officialWebsiteUrl),
  };
}

/** Public fields only, deduplicated within a request without persisting stale settings. */
export const getPublicSiteSettings = cache(async (): Promise<PublicSiteSettings> => {
  try {
    return await readSettings();
  } catch {
    console.error("Unable to load public site settings. Showing the existing site information.");
    return { ...DEFAULT_SITE_SETTINGS };
  }
});

export async function getSiteSettings(): Promise<PublicSiteSettings> {
  await requireAdmin();
  return readSettings();
}

function refreshSiteSettings(section: "about" | "contact") {
  revalidatePath("/", "layout");
  for (const path of ["/about", "/contact", "/portal/site-settings", `/portal/site-settings/${section}`]) revalidatePath(path);
}

async function saveSettings(data: Partial<PublicSiteSettings>, section: "about" | "contact"): Promise<SiteSettingsFormState> {
  try {
    // A single partial upsert preserves the other section, including concurrent edits.
    await prisma.siteSetting.upsert({
      where: { id: 1 },
      create: { id: 1, ...DEFAULT_SITE_SETTINGS, ...data },
      update: data,
    });
  } catch {
    console.error("Unable to save site settings.");
    return { success: false, message: "Unable to save site settings. Please try again." };
  }
  refreshSiteSettings(section);
  return { success: true, message: section === "about" ? "About Us settings updated successfully." : "Contact settings updated successfully." };
}

export async function updateAboutSettings(formData: FormData): Promise<SiteSettingsFormState> {
  await requireAdmin();
  const parsed = parseAboutSettings(formData);
  return parsed.success ? saveSettings(parsed.data, "about") : parsed;
}

export async function updateContactSettings(formData: FormData): Promise<SiteSettingsFormState> {
  await requireAdmin();
  const parsed = parseContactSettings(formData);
  return parsed.success ? saveSettings(parsed.data, "contact") : parsed;
}
