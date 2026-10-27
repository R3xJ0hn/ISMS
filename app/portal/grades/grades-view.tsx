"use client";

import { useOptimistic, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BookOpenCheck, ChevronDown } from "lucide-react";

import { GradesTableSkeleton } from "@/components/portal/grades-table-skeleton";

type GradesViewProps = {
  semester: string;
  schoolYear: string | null;
  schoolYears: readonly string[];
  hasUnassignedSemester: boolean;
  displayName: string;
  studentNumber: string | null;
  children: ReactNode;
};

export function GradesView({
  semester,
  schoolYear,
  schoolYears,
  hasUnassignedSemester,
  displayName,
  studentNumber,
  children,
}: GradesViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedSemester, setSelectedSemester] = useOptimistic(semester);
  const [selectedSchoolYear, setSelectedSchoolYear] = useOptimistic(schoolYear);

  function changeFilters(nextSchoolYear: string | null, nextSemester: string) {
    startTransition(() => {
      setSelectedSchoolYear(nextSchoolYear);
      setSelectedSemester(nextSemester);
      const query = new URLSearchParams({ ...(nextSchoolYear ? { schoolYear: nextSchoolYear } : {}), semester: nextSemester });
      router.push(`/portal/grades?${query}`);
    });
  }

  return (
    <>
      <header className="space-y-3">
        <Link href="/portal/classroom" className="inline-flex items-center gap-2 rounded-sm text-sm font-medium text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ArrowLeft className="size-4" aria-hidden="true" />All classes</Link>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">My grades</h1>
          <p className="mt-2 text-sm text-muted-foreground">View grades from your enrolled classes by school year and semester.</p>
        </div>
      </header>

      <section aria-label="Student grade record" className="flex min-w-0 flex-col gap-6 rounded-2xl border border-border bg-card p-5 sm:p-6 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 md:flex-1">
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-primary"><BookOpenCheck className="size-6" aria-hidden="true" /></span>
            <div className="min-w-0">
              <h2 className="break-words text-lg font-semibold text-foreground">{displayName}</h2>
              <p className="mt-1 break-all text-sm text-muted-foreground">Student No. {studentNumber ?? "Not assigned"}</p>
            </div>
          </div>
        </div>

        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-3 md:shrink-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <label htmlFor="school-year" className="text-sm font-medium text-foreground">School year</label>
            <select id="school-year" name="schoolYear" value={selectedSchoolYear && schoolYears.includes(selectedSchoolYear) ? selectedSchoolYear : ""}
              disabled={isPending || !schoolYears.length} onChange={(event) => changeFilters(event.target.value, selectedSemester)}
              className="h-10 max-w-full rounded-lg border border-input bg-card px-3 text-sm font-medium text-foreground outline-none transition disabled:cursor-wait disabled:opacity-70 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring">
              {(!selectedSchoolYear || !schoolYears.includes(selectedSchoolYear)) && <option value="" disabled>{schoolYears.length ? "Choose school year" : "No classes assigned"}</option>}
              {schoolYears.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <label htmlFor="semester" className="text-sm font-medium text-foreground">Semester</label>
            <div className="relative">
              <select id="semester" name="semester" value={selectedSemester} disabled={isPending}
                onChange={(event) => changeFilters(selectedSchoolYear, event.target.value)}
                className="h-10 appearance-none rounded-lg border border-input bg-card px-3 pr-9 text-sm font-medium text-foreground outline-none transition disabled:cursor-wait disabled:opacity-70 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring">
                <option value="1stSem">1st Semester</option>
                <option value="2ndSem">2nd Semester</option>
                {(hasUnassignedSemester || selectedSemester === "unassigned") && <option value="unassigned">Semester not assigned</option>}
              </select>
              <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>
        </div>
      </section>

      <div className="min-w-0" aria-busy={isPending}>
        {isPending ? <GradesTableSkeleton semester={selectedSemester} /> : children}
      </div>
    </>
  );
}
