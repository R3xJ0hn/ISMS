import { Facebook, Globe, MapPin } from "lucide-react";
import Link from "next/link";
import { SCHOOL } from "@/lib/public/site";

const linkGroups = [
  { title: "Programs", links: [
    { href: "/programs#senior-high", label: "Senior High School" },
    { href: "/programs#college", label: "College" },
  ] },
  { title: "Admissions", links: [
    { href: "/admission", label: "Procedures and Requirements" },
    { href: "/admission", label: "Online Reservation" },
  ] },
];

const contactLinks = [
  { href: SCHOOL.contact.map, label: SCHOOL.contact.address, icon: MapPin },
  { href: SCHOOL.contact.officialWebsite, label: "Our Official Website", icon: Globe },
  { href: SCHOOL.contact.facebook, label: "Datamex Meycauayan.", icon: Facebook },
];

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-primary text-slate-100">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          {linkGroups.map(({ title, links }) => (
            <div key={title}>
              <h3 className="text-sm font-semibold tracking-wide text-white">{title}</h3>
              <ul className="mt-4 space-y-2 text-sm">
                {links.map(({ href, label }) => (
                  <li key={label}>
                    <Link href={href} className="text-slate-300 transition-colors hover:text-white">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h3 className="text-sm font-semibold tracking-wide text-white">
              Contact
            </h3>

            <address className="mt-4 space-y-3 text-sm not-italic">
              {contactLinks.map(({ href, label, icon: Icon }, index) => (
                <a key={href} href={href} className={`group flex gap-3 text-slate-300 transition-colors hover:text-white ${index === 0 ? "items-start" : "items-center"}`}>
                  <Icon size={16} className={`shrink-0${index === 0 ? " mt-0.5" : ""}`} />
                  <span>{label}</span>
                </a>
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
