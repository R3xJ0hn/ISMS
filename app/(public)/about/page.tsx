import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, Compass, GraduationCap, MapPin } from "lucide-react";

import { SCHOOL } from "@/lib/public/site";
import { getPublicSiteSettings } from "@/lib/site-settings/service";

export const metadata: Metadata = {
  title: "About Us | Datamex College of Saint Adeline",
  description: "Learn about Datamex College of Saint Adeline and explore our programs and branches.",
};

export const dynamic = "force-dynamic";

const exploreLinks = [
  { href: "/programs", title: "Explore our programs", description: "Find an academic program for your next step.", icon: BookOpen },
  { href: "/branches", title: "Find a branch", description: "Browse campus locations and branch contact details.", icon: MapPin },
  { href: "/admission", title: "Apply for admission", description: "Start your application and prepare your requirements.", icon: GraduationCap },
];

export default async function AboutPage() {
  const settings = await getPublicSiteSettings();

  return (
    <>
      <section className="relative overflow-hidden bg-primary text-white">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full border-48 border-white/5" />
        <div className="relative mx-auto max-w-7xl px-5 py-12 sm:px-6 sm:py-16 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-widest text-accent">About our school</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-black tracking-tight [overflow-wrap:anywhere] sm:text-5xl lg:text-6xl">{settings.aboutTitle || "About Us"}</h1>
          <p className="mt-5 text-base text-white/85 sm:text-lg">{SCHOOL.name}</p>
        </div>
      </section>

      <section aria-labelledby="school-overview-heading" className="mx-auto grid max-w-7xl items-start gap-8 px-5 py-12 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-12 lg:px-8">
        <div className="min-w-0">
          <h2 id="school-overview-heading" className="text-3xl font-bold tracking-tight text-primary">Get to know Datamex</h2>
          {settings.aboutIntro && <p className="mt-5 whitespace-pre-line text-base leading-8 text-gray-600 [overflow-wrap:anywhere]">{settings.aboutIntro}</p>}
          <Link href="/contact" className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">Get in touch<ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-gray-100 shadow-sm">
          <Image src={SCHOOL.assets.campus} alt="Datamex College of Saint Adeline campus" fill sizes="(max-width: 1024px) 100vw, 45vw" className="object-cover" />
        </div>
      </section>

      {(settings.mission || settings.vision) && (
        <section aria-label="Our mission and vision" className="bg-gray-50">
          <div className="mx-auto grid max-w-7xl gap-6 px-5 py-12 sm:px-6 sm:py-16 md:grid-cols-2 lg:px-8">
            {[{ title: "Our mission", text: settings.mission, icon: GraduationCap }, { title: "Our vision", text: settings.vision, icon: Compass }].filter(({ text }) => text).map(({ title, text, icon: Icon }) => (
              <article key={title} className="min-w-0 rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
                <Icon size={28} aria-hidden="true" className="text-primary" />
                <h2 className="mt-5 text-2xl font-bold text-primary">{title}</h2>
                <p className="mt-4 whitespace-pre-line leading-7 text-gray-600 [overflow-wrap:anywhere]">{text}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="explore-heading" className="mx-auto max-w-7xl px-5 py-12 sm:px-6 sm:py-16 lg:px-8">
        <h2 id="explore-heading" className="text-3xl font-bold tracking-tight text-primary">Your next step</h2>
        <div className="mt-7 grid gap-5 md:grid-cols-3">
          {exploreLinks.map(({ href, title, description, icon: Icon }) => (
            <Link key={href} href={href} className="group flex min-w-0 flex-col rounded-xl border border-gray-200 p-6 transition hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
              <Icon size={24} aria-hidden="true" className="text-primary" />
              <h3 className="mt-4 text-lg font-bold text-gray-900">{title}</h3>
              <p className="mt-2 flex-1 text-sm leading-6 text-gray-600">{description}</p>
              <ArrowRight size={18} aria-hidden="true" className="mt-5 text-primary transition-transform group-hover:translate-x-1" />
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
