"use client";

import Link from "next/link";
import { useActionState, useState, type ChangeEvent } from "react";
import { ExternalLink, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePortalFormFeedback } from "@/components/portal/toasts";
import type { PublicSiteSettings } from "@/lib/site-settings/defaults";
import type { SiteSettingsFormState } from "@/lib/site-settings/validation";
import { cn } from "@/lib/utils";
import { saveAboutSettingsAction, saveContactSettingsAction } from "./actions";

type Field = {
  name: keyof PublicSiteSettings;
  label: string;
  required?: boolean;
  multiline?: boolean;
  wide?: boolean;
  help?: string;
  type?: "email" | "tel" | "url";
};

const aboutFields: Field[] = [
  { name: "aboutTitle", label: "Page title", required: true, wide: true },
  { name: "aboutIntro", label: "About the school", required: true, multiline: true, wide: true },
  { name: "mission", label: "Mission", multiline: true, help: "Leave blank to hide this section." },
  { name: "vision", label: "Vision", multiline: true, help: "Leave blank to hide this section." },
];

const contactSections: Array<{ title: string; fields: Field[] }> = [
  { title: "Contact information", fields: [
    { name: "contactIntro", label: "Contact introduction", multiline: true, wide: true },
    { name: "contactEmail", label: "Email address", required: true, type: "email" },
    { name: "contactPhone", label: "Phone number", required: true, type: "tel" },
    { name: "contactAddress", label: "School address", required: true, multiline: true, wide: true },
    { name: "officeHours", label: "Office hours", multiline: true, wide: true, help: "Leave blank to hide office hours." },
  ] },
  { title: "Website and social links", fields: [
    { name: "mapUrl", label: "Map link", type: "url", wide: true, help: "Paste the school location link, or leave blank to hide it." },
    { name: "facebookUrl", label: "Facebook page", type: "url", wide: true },
    { name: "officialWebsiteUrl", label: "Official website", type: "url", wide: true },
  ] },
];

const initialState: SiteSettingsFormState = { success: false, message: "" };

export function SiteSettingsForm({ section, settings }: {
  section: "about" | "contact";
  settings: PublicSiteSettings;
}) {
  const [values, setValues] = useState(settings);
  const [state, formAction, pending] = useActionState(
    section === "about" ? saveAboutSettingsAction : saveContactSettingsAction,
    initialState
  );
  const formRef = usePortalFormFeedback(state, { returnTo: "/portal/site-settings" });

  function changeField(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  }

  function renderField(field: Field) {
    const id = `site-settings-${field.name}`;
    const error = state.fieldErrors?.[field.name];
    const props = {
      id, name: field.name, value: values[field.name], required: field.required,
      onChange: changeField,
      "aria-invalid": Boolean(error),
      "aria-describedby": [field.help ? `${id}-help` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined,
    };

    return (
      <div key={field.name} className={cn("min-w-0 space-y-2", field.wide && "md:col-span-2")}>
        <label htmlFor={id} className="block text-sm font-medium">
          {field.label}{field.required && <span className="text-destructive"> *</span>}
        </label>
        {field.multiline ? (
          <textarea {...props} rows={field.name === "aboutIntro" ? 7 : 4}
            className="w-full min-w-0 rounded-md border border-input bg-background px-3 py-3 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 aria-invalid:border-destructive lg:text-sm" />
        ) : (
          <Input {...props} type={field.type ?? "text"}
            autoComplete={field.type === "email" ? "email" : field.type === "tel" ? "tel" : "off"}
            className="h-12 min-w-0 text-base lg:h-11 lg:text-sm" />
        )}
        {field.help && <p id={`${id}-help`} className="text-xs leading-5 text-muted-foreground">{field.help}</p>}
        {error && <p id={`${id}-error`} className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  const sections = section === "about"
    ? [{ title: "About Us content", fields: aboutFields }]
    : contactSections;

  return (
    <form ref={formRef} action={formAction} aria-busy={pending} className="w-full max-w-5xl space-y-6">
      {sections.map(({ title, fields }) => (
        <fieldset key={title} disabled={pending || state.success}
          className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-sm sm:p-6">
          <legend className="px-2 text-base font-semibold">{title}</legend>
          <div className="grid min-w-0 gap-5 md:grid-cols-2">{fields.map(renderField)}</div>
        </fieldset>
      ))}
      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background/95 py-4 backdrop-blur">
        <a href={section === "about" ? "/about" : "/contact"} target="_blank" rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          <ExternalLink size={16} aria-hidden="true" /> View public page
        </a>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button asChild type="button" variant="outline" className="min-h-12 flex-1 sm:flex-none">
            <Link href="/portal/site-settings">Back</Link>
          </Button>
          <Button type="submit" disabled={pending || state.success} className="min-h-12 flex-1 sm:flex-none">
            <Save size={16} aria-hidden="true" />{pending ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </div>
    </form>
  );
}
