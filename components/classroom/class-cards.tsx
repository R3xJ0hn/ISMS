"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { ArrowRight, BookOpen, Building2, CalendarDays, ChevronDown, Search, SlidersHorizontal, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StudentThumbnails } from "@/components/portal/student-thumbnails";
import { academicLevelOptions, formatAcademicLevel, formatSemester, semesterOptions } from "@/lib/academic-levels";
import { classTableGrouping } from "@/lib/classes/grouping";
import { classStatusOptions, getClassStatusOption } from "@/lib/classes/presentation";
import type { ClassStudentPreview } from "@/lib/classes/student-preview";
import type { AcademicLevel, ClassStatus, Semester } from "@/lib/generated/prisma/enums";
import { cn } from "@/lib/utils";
import { ClassCoverDecoration, classCoverTheme } from "./class-banner";

export type ClassroomCardData = {
  id: string;
  href: string;
  classCode: string;
  status: ClassStatus;
  programId: string | null;
  programCode: string | null;
  programLabel: string | null;
  subjectName: string;
  sectionName: string;
  yearLevel: AcademicLevel;
  schoolYear: string;
  semester: Semester | null;
  branchTitle: string | null;
  teacherName?: string;
  studentCount?: number;
  studentPreviews?: ClassStudentPreview[];
  spreadsheetLinked: boolean;
};

function ClassroomClassCard({ assignedClass, role }: { assignedClass: ClassroomCardData; role: "teacher" | "student" }) {
  const classStatus = getClassStatusOption(assignedClass.status) ?? classStatusOptions[0];
  return (
    <article className="group relative isolate flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:border-primary/40 hover:shadow-md">
      <Link href={assignedClass.href} aria-label={`Open ${assignedClass.subjectName}, ${assignedClass.sectionName}, ${assignedClass.classCode}`} className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" />
      <div className={cn("relative min-h-44 overflow-hidden p-6 text-white", classCoverTheme(assignedClass.id))}>
        <ClassCoverDecoration />
        <div className="relative">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-white/90">{assignedClass.schoolYear}</p>
          <h3 className="break-words text-2xl font-semibold leading-8 tracking-tight">{assignedClass.subjectName}</h3>
          <p className="mt-2 break-words text-sm text-white/90">{assignedClass.sectionName}</p>
        </div>
        <div className="absolute bottom-4 right-4 z-20">
          <StudentThumbnails students={assignedClass.studentPreviews} count={assignedClass.studentCount} />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 px-6 py-5">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <p className="min-w-0 text-xs text-muted-foreground">Class code <span className="font-mono font-medium text-foreground [overflow-wrap:anywhere]">{assignedClass.classCode}</span></p>
          <span className={cn("inline-flex rounded-full border px-2 py-1 text-xs font-medium", classStatus.badgeClassName)}>{classStatus.label}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <p className="font-medium">{formatAcademicLevel(assignedClass.yearLevel)}</p>
          <span aria-hidden="true" className="text-muted-foreground">·</span>
          <p className="text-muted-foreground">{formatSemester(assignedClass.semester)}</p>
        </div>
        {assignedClass.teacherName && <p className="break-words text-sm text-muted-foreground">{assignedClass.teacherName}</p>}
        <p className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground"><Building2 aria-hidden="true" className="size-4 shrink-0" /><span className="min-w-0 [overflow-wrap:anywhere]">{assignedClass.branchTitle ?? "Branch not assigned"}</span></p>
        {role === "teacher" && assignedClass.studentCount !== undefined && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Users aria-hidden="true" className="size-4" />{assignedClass.studentCount} {assignedClass.studentCount === 1 ? "student" : "students"}</p>}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4 text-sm">
        <span className={cn("inline-flex items-center gap-2", role === "teacher" && !assignedClass.spreadsheetLinked ? "text-red-700" : "text-muted-foreground")}><BookOpen aria-hidden="true" className="size-4 shrink-0" />{assignedClass.spreadsheetLinked ? "Grades connected" : role === "teacher" ? "Add Google Sheets link" : "Class details"}</span>
        <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-primary transition-transform group-hover:translate-x-1" />
      </div>
    </article>
  );
}

function ClassroomGroupHeader({ assignedClass, headingId, count }: { assignedClass: ClassroomCardData; headingId: string; count: number }) {
  return (
    <header className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
      <div className="min-w-0 flex-1 border-l-4 border-primary pl-3 sm:pl-4">
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><CalendarDays aria-hidden="true" className="size-3.5 shrink-0" />{assignedClass.schoolYear}</span>
          <span>{formatSemester(assignedClass.semester)}</span>
        </div>
        <h2 id={headingId} className="flex min-w-0 flex-wrap items-center gap-2.5">
          <span className="sr-only">{assignedClass.schoolYear}, {formatSemester(assignedClass.semester)}, </span>
          <span className="min-w-0 max-w-full rounded-md bg-primary/10 px-2.5 py-1 text-sm font-bold tracking-wide text-primary [overflow-wrap:anywhere]">{assignedClass.programCode ?? "Program not assigned"}</span>
          <span className="min-w-0 text-base font-semibold [overflow-wrap:anywhere]">{formatAcademicLevel(assignedClass.yearLevel)}</span>
        </h2>
      </div>
      <p className="shrink-0 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">{count} {count === 1 ? "class" : "classes"}</p>
    </header>
  );
}

export function ClassroomClassGrid({ classes, role }: { classes: ClassroomCardData[]; role: "teacher" | "student" }) {
  const searchId = useId();
  const yearId = useId();
  const semesterId = useId();
  const levelId = useId();
  const programId = useId();
  const statusId = useId();
  const groupId = useId();
  const filterPanelId = useId();
  const [query, setQuery] = useState("");
  const [schoolYear, setSchoolYear] = useState("");
  const [semester, setSemester] = useState("");
  const [yearLevel, setYearLevel] = useState("");
  const [program, setProgram] = useState("");
  const [status, setStatus] = useState("");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const schoolYears = [...new Set(classes.map((assignedClass) => assignedClass.schoolYear))].sort((a, b) => b.localeCompare(a));
  const yearLevels = academicLevelOptions.filter((level) => classes.some((assignedClass) => assignedClass.yearLevel === level.value));
  const hasUnassignedSemester = classes.some((assignedClass) => !assignedClass.semester);
  const programs = [...new Map(classes.filter((assignedClass) => assignedClass.programId !== null).map((assignedClass) => [assignedClass.programId!, assignedClass.programCode ?? "Unnamed program"])).entries()]
    .sort((left, right) => left[1].localeCompare(right[1], "en", { numeric: true, sensitivity: "base" }));
  const hasUnassignedProgram = classes.some((assignedClass) => assignedClass.programId === null);
  const hasFilters = Boolean(query.trim() || schoolYear || semester || yearLevel || program || status);
  const activeFilterCount = [schoolYear, semester, yearLevel, program, status].filter(Boolean).length;
  const searchTerms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const filteredClasses = classes.filter((assignedClass) => {
    if (schoolYear && assignedClass.schoolYear !== schoolYear) return false;
    if (semester && (semester === "unassigned" ? assignedClass.semester != null : assignedClass.semester !== semester)) return false;
    if (yearLevel && assignedClass.yearLevel !== yearLevel) return false;
    if (program && (program === "unassigned" ? assignedClass.programId !== null : assignedClass.programId !== program)) return false;
    if (status && assignedClass.status !== status) return false;
    const searchable = [assignedClass.classCode, getClassStatusOption(assignedClass.status)?.label, assignedClass.programCode, assignedClass.programLabel, assignedClass.subjectName, assignedClass.sectionName, assignedClass.schoolYear,
      assignedClass.branchTitle, assignedClass.teacherName, formatAcademicLevel(assignedClass.yearLevel), formatSemester(assignedClass.semester)].filter(Boolean).join(" ").toLocaleLowerCase();
    return searchTerms.every((term) => searchable.includes(term));
  });
  const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
  const sortedClasses = [...filteredClasses].sort((left, right) => classTableGrouping.compare(left, right)
    || classStatusOptions.findIndex((option) => option.value === left.status) - classStatusOptions.findIndex((option) => option.value === right.status)
    || collator.compare(left.subjectName, right.subjectName) || collator.compare(left.sectionName, right.sectionName)
    || collator.compare(left.classCode, right.classCode) || collator.compare(left.id, right.id));
  const groups = new Map<string, { classes: ClassroomCardData[] }>();
  for (const assignedClass of sortedClasses) {
    const key = classTableGrouping.key(assignedClass);
    const group = groups.get(key) ?? { classes: [] };
    group.classes.push(assignedClass);
    groups.set(key, group);
  }

  function clearFilters() {
    setQuery("");
    setSchoolYear("");
    setSemester("");
    setYearLevel("");
    setProgram("");
    setStatus("");
  }

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
      <div className="sticky top-16 z-30 -mx-4 flex flex-col gap-3 border-b border-border bg-background px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-1 md:min-w-56">
            <label htmlFor={searchId} className="sr-only">Search my classes</label>
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id={searchId} role="searchbox" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your classes..." className="h-10 rounded-lg bg-card pl-9 pr-10" />
            {query && <Button type="button" variant="ghost" size="icon-sm" aria-label="Clear search" className="absolute right-1 top-1/2 -translate-y-1/2" onClick={() => setQuery("")}><X aria-hidden="true" /></Button>}
          </div>
          <Button type="button" variant="outline" className="h-10 shrink-0 rounded-lg bg-card md:hidden" aria-label="Toggle class filters"
            aria-expanded={mobileFiltersOpen} aria-controls={filterPanelId} onClick={() => setMobileFiltersOpen((open) => !open)}>
            <SlidersHorizontal aria-hidden="true" />Filters
            {activeFilterCount > 0 && <span aria-label={`${activeFilterCount} active filters`} className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">{activeFilterCount}</span>}
            <ChevronDown aria-hidden="true" className={cn("size-4 transition-transform motion-reduce:transition-none", mobileFiltersOpen && "rotate-180")} />
          </Button>
          <div id={filterPanelId} className={cn("max-h-[calc(100dvh-14rem)] w-full flex-wrap items-center gap-3 overflow-y-auto overscroll-contain rounded-xl border border-border bg-card p-3 md:contents", mobileFiltersOpen ? "flex" : "hidden")}>
            <label htmlFor={yearId} className="sr-only">Filter by school year</label>
            <select id={yearId} value={schoolYear} onChange={(event) => setSchoolYear(event.target.value)} className="h-10 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto">
              <option value="">All school years</option>
              {schoolYears.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
            <label htmlFor={semesterId} className="sr-only">Filter by semester</label>
            <select id={semesterId} value={semester} onChange={(event) => setSemester(event.target.value)} className="h-10 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto">
              <option value="">All semesters</option>
              {semesterOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              {hasUnassignedSemester && <option value="unassigned">Semester not assigned</option>}
            </select>
            <label htmlFor={levelId} className="sr-only">Filter by year level</label>
            <select id={levelId} value={yearLevel} onChange={(event) => setYearLevel(event.target.value)} className="h-10 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto">
              <option value="">All year levels</option>
              {yearLevels.map((level) => <option key={level.value} value={level.value}>{level.label}</option>)}
            </select>
            <label htmlFor={programId} className="sr-only">Filter by program</label>
            <select id={programId} value={program} onChange={(event) => setProgram(event.target.value)} className="h-10 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto sm:max-w-72">
              <option value="">All programs</option>
              {programs.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              {hasUnassignedProgram && <option value="unassigned">Program not assigned</option>}
            </select>
            <label htmlFor={statusId} className="sr-only">Filter by class status</label>
            <select id={statusId} value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto">
              <option value="">All statuses</option>
              {classStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
        </div>
        {hasFilters && <div className="flex justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={clearFilters}><X aria-hidden="true" />Clear filters</Button>
        </div>}
      </div>
      {filteredClasses.length ? (
        <div className="space-y-8">
          {Array.from(groups.entries(), ([key, group], index) => (
            <section key={key} aria-labelledby={`${groupId}-${index}`} className="min-w-0 space-y-4">
              <ClassroomGroupHeader assignedClass={group.classes[0]} headingId={`${groupId}-${index}`} count={group.classes.length} />
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                {group.classes.map((assignedClass) => <ClassroomClassCard key={assignedClass.id} assignedClass={assignedClass} role={role} />)}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <h2 className="font-semibold">No classes match your filters</h2>
          <p className="mt-2 text-sm text-muted-foreground">Try another search or adjust your class filters.</p>
          <Button type="button" variant="outline" className="mt-5" onClick={clearFilters}>Clear filters</Button>
        </div>
      )}
    </section>
  );
}
