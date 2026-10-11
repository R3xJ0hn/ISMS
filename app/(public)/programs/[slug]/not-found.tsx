import Link from "next/link";
import { ArrowLeft } from "lucide-react";


export default function ProgramNotFound() {
  return (
    <>
      <section className="mx-auto max-w-3xl px-5 py-20 text-center sm:px-6">
        <p className="text-sm font-semibold uppercase tracking-widest text-secondary">Program not found</p>
        <h1 className="mt-4 text-3xl font-bold text-primary sm:text-4xl">We couldn&apos;t find that program</h1>
        <p className="mt-4 leading-7 text-gray-600">Browse our programs to choose a college course or senior high school track.</p>
        <Link href="/programs" className="mt-8 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-white transition hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
          <ArrowLeft size={18} aria-hidden="true" /> Back to all programs
        </Link>
      </section>

    </>
  );
}
