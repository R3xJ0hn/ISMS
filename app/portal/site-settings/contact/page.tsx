import { getSiteSettings } from "@/lib/site-settings/service";
import { SiteSettingsForm } from "../site-settings-form";

export default async function ContactSettingsPage() {
  const settings = await getSiteSettings();
  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <header>
        <p className="text-sm text-muted-foreground">Site Settings</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Manage Contact</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Changes update the Contact page and shared website contact details.</p>
      </header>
      <SiteSettingsForm section="contact" settings={settings} />
    </main>
  );
}
