import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";

import { BranchCard } from "@/components/public/school-branches";
import { getAdmissionBranches } from "@/lib/admission/catalog";

export const metadata: Metadata = {
  title: "Branches | Datamex College of Saint Adeline",
  description: "Find Datamex College of Saint Adeline branches, campus locations, and contact details.",
};

export const dynamic = "force-dynamic";

export default async function BranchesPage() {
  const { branches, error } = await getAdmissionBranches();

  return (
    <>
      <section className="relative overflow-hidden bg-primary text-white">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full border-48 border-white/5" />
        <div className="relative mx-auto max-w-7xl px-5 py-12 sm:px-6 sm:py-16 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-widest text-accent">Our school branches</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">Find your Datamex branch</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/85 sm:text-lg">Explore our campuses, find their locations, and contact your preferred branch about admissions.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#branch-directory" className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground transition hover:bg-accent/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"><MapPin size={18} aria-hidden="true" />Browse branches</a>
            <Link href="/admission" className="inline-flex items-center gap-2 rounded-lg border border-white/40 px-5 py-3 text-sm font-semibold transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">Apply for admission<ArrowRight size={16} aria-hidden="true" /></Link>
          </div>
        </div>
      </section>

      <section id="branch-directory" aria-labelledby="branch-directory-heading" className="mx-auto max-w-7xl scroll-mt-28 px-5 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 id="branch-directory-heading" className="text-3xl font-bold tracking-tight text-primary">Our campuses</h2>
            <p className="mt-3 max-w-2xl leading-7 text-gray-600">Find the address and contact information for each branch below.</p>
          </div>
          {!error && branches.length > 0 && <span className="rounded-full border border-primary/15 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary">{branches.length} {branches.length === 1 ? "branch" : "branches"}</span>}
        </div>
        {error ? (
          <div role="status" className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center">
            <MapPin aria-hidden="true" className="mx-auto mb-4 size-8 text-gray-400" />
            <h3 className="font-semibold text-gray-900">Branches are unavailable right now</h3>
            <p className="mt-2 text-sm text-gray-600">Please try again later to view our campus locations and contact details.</p>
          </div>
        ) : branches.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
            <MapPin aria-hidden="true" className="mx-auto mb-4 size-8 text-gray-400" />
            <h3 className="font-semibold text-gray-900">No branches are available yet</h3>
            <p className="mt-2 text-sm text-gray-600">Campus locations and contact details will appear here when available.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {branches.map((branch) => <BranchCard key={branch.id} branch={branch} expanded />)}
          </div>
        )}
      </section>
    </>
  );
}
