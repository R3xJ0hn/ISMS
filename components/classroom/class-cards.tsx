"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { ArrowRight, BookOpen, Building2, Search, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatAcademicLevel } from "@/lib/academic-levels";
import type { AcademicLevel } from "@/lib/generated/prisma/enums";
import { cn } from "@/lib/utils";
import { ClassCoverDecoration, classCoverTheme } from "./class-banner";

export type ClassroomCardData = {
  id: string;
  href: string;
  subjectName: string;
  sectionName: string;
  yearLevel: AcademicLevel;
  schoolYear: string;
  branchTitle: string | null;
  teacherName?: string;
  studentCount?: number;
  spreadsheetLinked: boolean;
};

export function ClassroomClassGrid({ classes, role }: { classes: ClassroomCardData[]; role: "teacher" | "student" }) {
  const searchId = useId();
  const yearId = useId();
  const [query, setQuery] = useState("");
  const [schoolYear, setSchoolYear] = useState("");
  const schoolYears = [...new Set(classes.map((assignedClass) => assignedClass.schoolYear))].sort((a, b) => b.localeCompare(a));
  const searchTerms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const filteredClasses = classes.filter((assignedClass) => {
    if (schoolYear && assignedClass.schoolYear !== schoolYear) return false;
    const searchable = [assignedClass.subjectName, assignedClass.sectionName, assignedClass.schoolYear,
      assignedClass.branchTitle, assignedClass.teacherName, formatAcademicLevel(assignedClass.yearLevel)].filter(Boolean).join(" ").toLocaleLowerCase();
    return searchTerms.every((term) => searchable.includes(term));
  });

  if (!classes.length) {
    return (
      <section className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card px-6 py-20 text-center" aria-label="Assigned classes">
        <div className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary"><BookOpen aria-hidden="true" className="size-8" /></div>
        <h2 className="text-lg font-semibold">No classes assigned yet</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">Your classes will appear here when the administrator assigns them to {role === "teacher" ? "your teacher account" : "your student record"}.</p>
      </section>
    );
  }

  return (
    <section className="space-y-6" aria-label="Assigned classes">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:max-w-sm">
          <label htmlFor={searchId} className="sr-only">Search my classes</label>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input id={searchId} role="searchbox" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your classes..." className="h-10 rounded-lg bg-card pl-9 pr-10" />
          {query && <Button type="button" variant="ghost" size="icon-sm" aria-label="Clear search" className="absolute right-1 top-1/2 -translate-y-1/2" onClick={() => setQuery("")}><X aria-hidden="true" /></Button>}
        </div>
        <label htmlFor={yearId} className="sr-only">Filter by school year</label>
        <select id={yearId} value={schoolYear} onChange={(event) => setSchoolYear(event.target.value)} className="h-10 max-w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <option value="">All school years</option>
          {schoolYears.map((year) => <option key={year} value={year}>{year}</option>)}
        </select>
        <p role="status" className="text-sm text-muted-foreground sm:ml-auto">{filteredClasses.length} {filteredClasses.length === 1 ? "class" : "classes"}{query.trim() || schoolYear ? ` of ${classes.length}` : ""}</p>
      </div>
      {filteredClasses.length ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredClasses.map((assignedClass) => (
            <Link key={assignedClass.id} href={assignedClass.href} aria-label={`Open ${assignedClass.subjectName}, ${assignedClass.sectionName}`} className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:border-primary/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
              <div className={cn("relative isolate min-h-44 overflow-hidden p-6 text-white", classCoverTheme(assignedClass.id))}>
                <ClassCoverDecoration />
                <div className="relative">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-white/80">{assignedClass.schoolYear}</p>
                  <h2 className="break-words text-2xl font-semibold leading-8 tracking-tight">{assignedClass.subjectName}</h2>
                  <p className="mt-2 break-words text-sm text-white/90">{assignedClass.sectionName}</p>
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-3 px-6 py-5">
                <p className="text-sm font-medium">{formatAcademicLevel(assignedClass.yearLevel)}</p>
                {assignedClass.teacherName && <p className="break-words text-sm text-muted-foreground">{assignedClass.teacherName}</p>}
                <p className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground"><Building2 aria-hidden="true" className="size-4 shrink-0" /><span className="min-w-0 [overflow-wrap:anywhere]">{assignedClass.branchTitle ?? "Branch not assigned"}</span></p>
                {role === "teacher" && assignedClass.studentCount !== undefined && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Users aria-hidden="true" className="size-4" />{assignedClass.studentCount} {assignedClass.studentCount === 1 ? "student" : "students"}</p>}
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4 text-sm">
                <span className={cn("inline-flex items-center gap-2", role === "teacher" && !assignedClass.spreadsheetLinked ? "text-red-700" : "text-muted-foreground")}><BookOpen aria-hidden="true" className="size-4 shrink-0" />{assignedClass.spreadsheetLinked ? "Grades connected" : role === "teacher" ? "Add Google Sheets link" : "Class details"}</span>
                <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-primary transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <h2 className="font-semibold">No classes match your filters</h2>
          <p className="mt-2 text-sm text-muted-foreground">Try another subject, section, or school year.</p>
          <Button type="button" variant="outline" className="mt-5" onClick={() => { setQuery(""); setSchoolYear(""); }}>Clear filters</Button>
        </div>
      )}
    </section>
  );
}
