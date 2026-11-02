import Link from "next/link";
import { Copy, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PortalCount, PortalPageHeader } from "@/components/portal/page-header";
import {
  getAcademicSchemes,
  getProgramAcademicDefaults,
} from "@/lib/academics/admin";
import { ProgramSchemeForm } from "./scheme-form";

export default async function AcademicTermsPage() {
  const [schemes, programs] = await Promise.all([
    getAcademicSchemes(),
    getProgramAcademicDefaults(),
  ]);
  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <PortalPageHeader
        label="Academics"
        title="Academic Terms"
        description="Set up semesters, trimesters and grading periods for each curriculum."
      >
        <div className="flex flex-wrap items-center gap-3">
          <PortalCount count={schemes.length} label="schemes" />
          <Button asChild>
            <Link href="/portal/academic-terms/new">
              <Plus aria-hidden="true" />
              Add scheme
            </Link>
          </Button>
        </div>
      </PortalPageHeader>
      <ProgramSchemeForm programs={programs} schemes={schemes} />
      {!schemes.length && (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <h2 className="font-semibold">No academic schemes yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Add a scheme and choose a preset to get started.
          </p>
        </div>
      )}
      {schemes.map((scheme) => (
        <section
          key={scheme.id}
          className="min-w-0 overflow-hidden rounded-lg border bg-card"
          aria-label={scheme.name}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
            <div className="min-w-0">
              <h2 className="wrap-anywhere font-semibold">{scheme.name}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {scheme.terms.length} terms ·{" "}
                {scheme.inUse
                  ? "In use — duplicate to make structural changes"
                  : "Available to edit"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm">
                <Link
                  href={`/portal/academic-terms/new?copy=${scheme.id}`}
                  aria-label={`Duplicate ${scheme.name}`}
                >
                  <Copy aria-hidden="true" />
                  Duplicate
                </Link>
              </Button>
              {!scheme.inUse && (
                <Button asChild variant="outline" size="sm">
                  <Link
                    href={`/portal/academic-terms/${scheme.id}/edit`}
                    aria-label={`Edit ${scheme.name}`}
                  >
                    <Pencil aria-hidden="true" />
                    Edit
                  </Link>
                </Button>
              )}
            </div>
          </div>
          <ol className="divide-y">
            {scheme.terms.map((term, index) => (
              <li
                key={index}
                className="grid gap-2 p-4 text-sm sm:grid-cols-[12rem_minmax(0,1fr)]"
              >
                <h3 className="wrap-anywhere font-medium">{term.name}</h3>
                <div className="flex min-w-0 flex-wrap gap-2">
                  {term.periods.map((period, index) => (
                    <span
                      key={index}
                      className="max-w-full wrap-anywhere rounded-md bg-muted px-2 py-1"
                    >
                      {period.name}
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({period.worksheetName})
                      </span>
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </main>
  );
}
