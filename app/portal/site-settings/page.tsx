import Link from "next/link";
import { ArrowRight, ExternalLink, Info, Mail } from "lucide-react";
import { getSiteSettings } from "@/lib/site-settings/service";

export default async function SiteSettingsPage() {
  const settings = await getSiteSettings();
  const sections = [
    { title: "About Us", icon: Info, href: "/portal/site-settings/about", publicHref: "/about",
      description: "Update the school overview, mission, and vision.", summary: settings.aboutTitle },
    { title: "Contact", icon: Mail, href: "/portal/site-settings/contact", publicHref: "/contact",
      description: "Manage contact details, office hours, and website links.", summary: settings.contactEmail },
  ];

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Site Settings</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Manage the information visitors see on the public website.
        </p>
      </div>
      <div className="grid w-full max-w-5xl gap-5 md:grid-cols-2">
        {sections.map(({ title, icon: Icon, href, publicHref, description, summary }) => (
          <section key={title} className="min-w-0 rounded-lg border border-border bg-card p-5 shadow-sm sm:p-6">
            <div className="grid size-12 place-items-center rounded-lg bg-primary/10 text-primary"><Icon size={24} aria-hidden="true" /></div>
            <h2 className="mt-4 text-xl font-semibold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
            <p className="mt-4 text-sm font-medium [overflow-wrap:anywhere]">{summary}</p>
            <div className="mt-5 flex flex-wrap items-center gap-4">
              <Link href={href} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                Manage {title}<ArrowRight size={16} aria-hidden="true" />
              </Link>
              <a href={publicHref} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                View page<ExternalLink size={15} aria-hidden="true" />
              </a>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
