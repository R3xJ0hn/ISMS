import { Facebook, Globe, Mail, MapPin, Phone } from "lucide-react";
import Link from "next/link";
import { SCHOOL } from "@/lib/public/site";
import { safeEmailHref, safePhoneHref } from "@/lib/public/contact-links";
import { DEFAULT_SITE_SETTINGS, type PublicSiteSettings } from "@/lib/site-settings/defaults";
import { safeExternalUrl } from "@/lib/site-settings/validation";

const linkGroups = [
  { title: "Programs", links: [
    { href: "/programs#senior-high", label: "Senior High School" },
    { href: "/programs#college", label: "College" },
  ] },
  { title: "Admissions", links: [
    { href: "/admission", label: "Procedures and Requirements" },
    { href: "/admission", label: "Online Reservation" },
    { href: "/branches", label: "School Branches" },
  ] },
  { title: "Our school", links: [
    { href: "/about", label: "About Us" },
    { href: "/contact", label: "Contact Us" },
    { href: "/portal", label: "MyDCSAePortal" },
  ] },
];

export default function Footer({ settings = DEFAULT_SITE_SETTINGS }: { settings?: PublicSiteSettings } = {}) {
  const currentYear = new Date().getFullYear();
  const contactLinks = [
    { href: safeExternalUrl(settings.mapUrl), label: settings.contactAddress, icon: MapPin },
    { href: safePhoneHref(settings.contactPhone), label: settings.contactPhone, icon: Phone },
    { href: safeEmailHref(settings.contactEmail), label: settings.contactEmail, icon: Mail },
    { href: safeExternalUrl(settings.officialWebsiteUrl), label: "Our Official Website", icon: Globe },
    { href: safeExternalUrl(settings.facebookUrl), label: "Facebook page", icon: Facebook },
  ].filter(({ href, label }, index) => label && (index < 3 || href));

  return (
    <footer className="w-full bg-primary text-slate-100">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {linkGroups.map(({ title, links }) => (
            <div key={title} className="min-w-0">
              <h3 className="text-sm font-semibold tracking-wide text-white">{title}</h3>
              <ul className="mt-3 text-sm">
                {links.map(({ href, label }) => (
                  <li key={label}>
                    <Link href={href} className="inline-flex min-h-11 items-center py-2 text-slate-300 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="min-w-0">
            <h3 className="text-sm font-semibold tracking-wide text-white">
              Contact
            </h3>

            <address className="mt-3 text-sm not-italic">
              {contactLinks.map(({ href, label, icon: Icon }, index) => href ? (
                <a
                  key={`${index}-${label}`}
                  href={href}
                  target={href.startsWith("http") ? "_blank" : undefined}
                  rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
                  className="group flex min-h-11 items-start gap-3 py-2.5 text-slate-300 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                >
                  <Icon size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 whitespace-pre-line [overflow-wrap:anywhere]">{label}</span>
                </a>
              ) : (
                <p key={`${index}-${label}`} className="flex items-start gap-3 py-2.5 text-slate-300">
                  <Icon size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 whitespace-pre-line [overflow-wrap:anywhere]">{label}</span>
                </p>
              ))}
            </address>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 bg-gray-950">
        <div className="mx-auto max-w-7xl px-6 py-5">
          <span className="block text-center text-xs text-slate-400">
            Copyright {currentYear} {SCHOOL.name}. All rights
            reserved.
          </span>
        </div>
      </div>
    </footer>
  );
}
