import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, GraduationCap } from "lucide-react";

import { getProgramGroups } from "@/lib/public/programs";

export const metadata: Metadata = {
  title: "Programs | Datamex College of Saint Adeline",
  description:
    "Explore college courses and senior high school academic and TVL tracks at Datamex College of Saint Adeline.",
};

export const dynamic = "force-dynamic";

export default async function ProgramsPage() {
  const programGroups = await getProgramGroups();
  const firstSeniorHighGroup = programGroups.find((group) => group.educationLevel === "Senior High School");

  return (
    <>
      <section className="relative overflow-hidden bg-primary text-white">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full border-48 border-white/5" />
        <div className="relative mx-auto max-w-7xl px-5 py-12 sm:px-6 sm:py-16 lg:px-8">
          <p className="mt-5 text-sm font-semibold uppercase tracking-widest text-accent">
            Your path to success starts here
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
            Find the program for your future
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/85 sm:text-lg">
            Explore our college courses and senior high school tracks, and take
            the next step in your education at Datamex College of Saint Adeline.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#college"
              className="rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground transition hover:bg-accent/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              College Courses
            </a>
            <a
              href="#senior-high"
              className="rounded-lg border border-white/40 px-5 py-3 text-sm font-semibold transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              Senior High School
            </a>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-14 px-5 py-14 sm:px-6 sm:py-16 lg:px-8">
        {programGroups.map((group) => (
          <section
            key={group.id}
            id={group.id}
            aria-labelledby={`${group.id}-heading`}
            className="scroll-mt-28"
          >
            {group.id === firstSeniorHighGroup?.id && (
              <div id="senior-high" className="mb-8 scroll-mt-28">
                <p className="text-sm font-semibold uppercase tracking-widest text-secondary">
                  Senior High School
                </p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-primary">
                  Choose your track
                </h2>
                <p className="mt-3 max-w-2xl leading-7 text-gray-600">
                  Explore academic strands and technical-vocational pathways
                  that match your interests.
                </p>
              </div>
            )}
            <header
              className="mb-6 flex items-start gap-4 rounded-xl border-l-4 p-5 shadow-sm sm:items-center sm:p-6 border-accent bg-primary text-white"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/20">
                <group.icon size={24} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                {group.educationLevel === "College" ? (
                  <h2 id={`${group.id}-heading`} className="text-2xl font-bold sm:text-3xl">
                    {group.title}
                  </h2>
                ) : (
                  <h3 id={`${group.id}-heading`} className="text-2xl font-bold sm:text-3xl">
                    {group.title}
                  </h3>
                )}
                <p className="mt-1 text-sm leading-6 opacity-85">{group.description}</p>
              </div>
            </header>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.programs.map((program) => (
                <li key={program.slug}>
                  <Link
                    href={`/programs/${program.slug}`}
                    className="group flex h-full flex-col rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition hover:border-primary/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
                  >
                    <span aria-hidden="true" className="mb-4 block h-1 w-10 rounded-full bg-accent" />
                    <p className="text-base font-semibold leading-6 text-gray-900 group-hover:text-primary">
                      {program.title}
                    </p>
                    {program.note && (
                      <p className="mt-2 text-sm leading-6 text-gray-600">{program.note}</p>
                    )}
                    <span className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-semibold text-primary">
                      View program details <ArrowRight size={16} aria-hidden="true" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section aria-labelledby="apply-heading" className="flex flex-col gap-6 rounded-2xl bg-primary/5 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <GraduationCap size={32} aria-hidden="true" className="mt-1 hidden shrink-0 text-primary sm:block" />
            <div>
              <h2 id="apply-heading" className="text-2xl font-bold text-primary">
                Ready to take the next step?
              </h2>
              <p className="mt-2 max-w-2xl leading-7 text-gray-600">
                Start your admission application and select your preferred
                branch to see its available programs.
              </p>
            </div>
          </div>
          <Link
            href="/admission"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-secondary px-6 py-3 font-semibold text-white transition hover:bg-secondary/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          >
            Apply Now <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </section>
      </div>

    </>
  );
}
