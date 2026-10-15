import type { Metadata } from "next";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, ArrowUpRight, Clock, Facebook, Globe, Mail, MapPin, Phone } from "lucide-react";

import { safeEmailHref, safePhoneHref } from "@/lib/public/contact-links";
import { getPublicSiteSettings } from "@/lib/site-settings/service";
import { safeExternalUrl } from "@/lib/site-settings/validation";

export const metadata: Metadata = {
  title: "Contact Us | Datamex College of Saint Adeline",
  description: "Contact Datamex College of Saint Adeline for admissions and campus inquiries.",
};

export const dynamic = "force-dynamic";

function ContactCard({ title, value, href, icon: Icon, action }: { title: string; value: string; href?: string; icon: LucideIcon; action?: string }) {
  const content = <>
    <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/5 text-primary"><Icon size={22} aria-hidden="true" /></span>
    <h2 className="mt-5 text-xl font-bold text-gray-900">{title}</h2>
    <p className="mt-3 flex-1 whitespace-pre-line leading-7 text-gray-600 [overflow-wrap:anywhere]">{value}</p>
    {href && action && <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary">{action}<ArrowUpRight size={16} aria-hidden="true" /></span>}
  </>;
  const className = "flex min-w-0 flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-7";

  return href ? (
    <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noopener noreferrer" : undefined} className={`${className} transition hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary`}>{content}</a>
  ) : <article className={className}>{content}</article>;
}

export default async function ContactPage() {
  const settings = await getPublicSiteSettings();
  const emailHref = safeEmailHref(settings.contactEmail);
  const phoneHref = safePhoneHref(settings.contactPhone);
  const mapHref = safeExternalUrl(settings.mapUrl);
  const facebookHref = safeExternalUrl(settings.facebookUrl);
  const websiteHref = safeExternalUrl(settings.officialWebsiteUrl);
  const hasContactDetails = Boolean(settings.contactEmail || settings.contactPhone || settings.contactAddress || settings.officeHours || facebookHref || websiteHref || mapHref);

  return (
    <>
      <section className="relative overflow-hidden bg-primary text-white">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full border-48 border-white/5" />
        <div className="relative mx-auto max-w-7xl px-5 py-12 sm:px-6 sm:py-16 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-widest text-accent">Contact our school</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">We&apos;re here to help</h1>
          {settings.contactIntro && <p className="mt-5 max-w-3xl whitespace-pre-line text-base leading-7 text-white/85 [overflow-wrap:anywhere] sm:text-lg">{settings.contactIntro}</p>}
          <Link href="/branches" className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/40 px-5 py-3 text-sm font-semibold transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">Find your branch<ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
      </section>

      <section aria-label="School contact information" className="bg-gray-50">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-6 sm:py-16 lg:px-8">
          {hasContactDetails ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {settings.contactEmail && <ContactCard title="Email us" value={settings.contactEmail} href={emailHref} icon={Mail} action="Send an email" />}
              {settings.contactPhone && <ContactCard title="Call us" value={settings.contactPhone} href={phoneHref} icon={Phone} action="Call the school" />}
              {(settings.contactAddress || mapHref) && <ContactCard title="Visit us" value={settings.contactAddress || "Find our school on the map."} href={mapHref} icon={MapPin} action="Open in maps" />}
              {settings.officeHours && <ContactCard title="Office hours" value={settings.officeHours} icon={Clock} />}
              {facebookHref && <ContactCard title="Facebook" value="Follow the school for updates and announcements." href={facebookHref} icon={Facebook} action="Visit our Facebook page" />}
              {websiteHref && <ContactCard title="Official website" value="Visit the official school website for more information." href={websiteHref} icon={Globe} action="Open the official website" />}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
              <Mail aria-hidden="true" className="mx-auto size-8 text-gray-400" />
              <h2 className="mt-4 text-xl font-bold text-gray-900">Contact details will be available soon</h2>
              <p className="mt-3 leading-7 text-gray-600">Visit our branches page for campus contact information.</p>
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto flex max-w-7xl flex-col items-start gap-6 px-5 py-12 sm:px-6 sm:py-16 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold text-primary sm:text-3xl">Ready to start your application?</h2>
          <p className="mt-3 leading-7 text-gray-600">View our programs or apply for admission online.</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Link href="/programs" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-primary/25 px-5 py-3 text-sm font-semibold text-primary transition hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">Explore programs</Link>
          <Link href="/admission" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">Apply for admission<ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
      </section>
    </>
  );
}
