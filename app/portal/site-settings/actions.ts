"use server";

import { updateAboutSettings, updateContactSettings } from "@/lib/site-settings/service";
import type { SiteSettingsFormState } from "@/lib/site-settings/validation";

export async function saveAboutSettingsAction(_previousState: SiteSettingsFormState, formData: FormData) {
  return updateAboutSettings(formData);
}

export async function saveContactSettingsAction(_previousState: SiteSettingsFormState, formData: FormData) {
  return updateContactSettings(formData);
}
