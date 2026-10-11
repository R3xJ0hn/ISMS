import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, ChevronRight } from "lucide-react";

import { getProgramBySlug } from "@/lib/public/programs";

export const dynamic = "force-dynamic";

type ProgramPageProps = {
  params: Promise<{ slug: string }>;
};

async function resolveProgram(params: ProgramPageProps["params"]) {
  const { slug } = await params;
  const result = await getProgramBySlug(slug);

  if (!result) {
    notFound();
  }

  return result;
}

export async function generateMetadata({ params }: ProgramPageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getProgramBySlug(slug);

  if (!result) {
    return {
      title: "Program not found | Datamex College of Saint Adeline",
      robots: { index: false },
    };
  }

  const { program } = result;

  return {
    title: `${program.code} - ${program.title} | Datamex College of Saint Adeline`,
    description: program.overview,
  };
}

export default async function ProgramDetailPage({ params }: ProgramPageProps) {
  const { program, group } = await resolveProgram(params);
  const educationLevel = group.educationLevel;
  const relatedPrograms = group.programs.filter((item) => item.slug !== program.slug);

  return (
    <>
      <section className="relative overflow-hidden bg-primary text-white">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full border-[48px] border-white/5" />
        <div className="relative mx-auto max-w-7xl px-5 py-10 sm:px-6 sm:py-14 lg:px-8">
          <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-2 text-sm text-white/75">
              <li><Link href="/" className="hover:text-white hover:underline">Home</Link></li>
              <li aria-hidden="true"><ChevronRight size={16} /></li>
              <li><Link href="/programs" className="hover:text-white hover:underline">Programs</Link></li>
              <li aria-hidden="true"><ChevronRight size={16} /></li>
              <li aria-current="page" className="font-semibold text-white">{program.code}</li>
            </ol>
          </nav>
          <div className="mt-10 flex items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/10">
              <group.icon size={26} aria-hidden="true" />
            </span>
            <p className="text-sm font-semibold uppercase tracking-widest text-accent">
              {educationLevel} &middot; {program.code}
            </p>
          </div>
          <h1 className="mt-5 max-w-4xl text-3xl font-black leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            {program.title}
          </h1>
          <p className="mt-4 text-base leading-7 text-white/85 sm:text-lg">
            {group.description}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="grid items-start gap-10 lg:grid-cols-3">
          <div className="space-y-10 lg:col-span-2">
            <section aria-labelledby="overview-heading">
              <p className="text-sm font-semibold uppercase tracking-widest text-secondary">Discover {program.code}</p>
              <h2 id="overview-heading" className="mt-2 text-2xl font-bold text-primary sm:text-3xl">Program overview</h2>
              <p className="mt-4 text-base leading-8 text-gray-600 sm:text-lg">{program.overview}</p>
            </section>

            <section aria-labelledby="topics-heading">
              <h2 id="topics-heading" className="text-2xl font-bold text-primary">Topics to explore</h2>
              <p className="mt-3 leading-7 text-gray-600">Common areas within this field include:</p>
              <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                {program.focusAreas.map((topic) => (
                  <li key={topic} className="flex items-start gap-3 rounded-xl border bg-white p-4">
                    <Check size={18} aria-hidden="true" className="mt-1 shrink-0 text-secondary" />
                    <span className="text-sm font-medium leading-6 text-gray-800">{topic}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="pathways-heading">
              <h2 id="pathways-heading" className="text-2xl font-bold text-primary">{group.pathwayLabel}</h2>
              <ul className="mt-5 space-y-3">
                {program.pathways.map((pathway) => (
                  <li key={pathway} className="flex items-start gap-3 text-gray-600">
                    <ArrowRight size={18} aria-hidden="true" className="mt-1 shrink-0 text-primary" />
                    <span className="leading-7">{pathway}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <aside aria-labelledby="information-heading" className="rounded-2xl border bg-white p-6 shadow-sm sm:p-8">
            <h2 id="information-heading" className="text-xl font-bold text-primary">At a glance</h2>
            <dl className="mt-6 space-y-5 text-sm">
              <div>
                <dt className="text-gray-500">Program code</dt>
                <dd className="mt-1 font-semibold text-gray-900">{program.code}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Education level</dt>
                <dd className="mt-1 font-semibold text-gray-900">{educationLevel}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Category</dt>
                <dd className="mt-1">
                  <Link href={`/programs#${group.id}`} className="font-semibold text-primary underline underline-offset-4">{group.title}</Link>
                </dd>
              </div>
              {program.note && (
                <div>
                  <dt className="text-gray-500">Program note</dt>
                  <dd className="mt-1 leading-6 text-gray-900">{program.note}</dd>
                </div>
              )}
            </dl>
            <div className="mt-7 border-t pt-6">
              <h3 className="font-bold text-primary">Interested in this program?</h3>
              <p className="mt-3 text-sm leading-6 text-gray-600">
                Start your admission application and choose your preferred
                branch to view its available programs.
              </p>
              <Link href="/admission" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-secondary px-5 py-3 font-semibold text-white transition hover:bg-secondary/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
                Apply Now <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link href="/programs" className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
                <ArrowLeft size={16} aria-hidden="true" /> Back to all programs
              </Link>
            </div>
          </aside>
        </div>

        <section aria-labelledby="related-heading" className="mt-14 border-t pt-10">
          <h2 id="related-heading" className="text-2xl font-bold text-primary">Explore more in {group.title}</h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {relatedPrograms.map((related) => (
              <li key={related.slug}>
                <Link href={`/programs/${related.slug}`} className="flex h-full items-center justify-between gap-4 rounded-xl border bg-white p-5 transition hover:border-primary/40 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-secondary">{related.code}</p>
                    <p className="mt-2 font-semibold leading-6 text-gray-900">{related.title}</p>
                  </div>
                  <ArrowRight size={20} aria-hidden="true" className="shrink-0 text-primary" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

    </>
  );
}
