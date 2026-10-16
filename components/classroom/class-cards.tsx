"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { ArrowRight, BookOpen, Building2, Search, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { academicLevelOptions, formatAcademicLevel, formatSemester, semesterOptions } from "@/lib/academic-levels";
import { classStudentPreviewLimit, type ClassStudentPreview } from "@/lib/classes/student-preview";
import { studentThumbnailColor } from "@/lib/portal/classroom-colors";
import type { AcademicLevel, Semester } from "@/lib/generated/prisma/enums";
import { cn, getInitials } from "@/lib/utils";
import { ClassCoverDecoration, classCoverTheme } from "./class-banner";

export type ClassroomCardData = {
  id: string;
  href: string;
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

function StudentThumbnails({ students = [], count }: { students?: ClassStudentPreview[]; count?: number }) {
  const visible = students.slice(0, classStudentPreviewLimit);
  if (!visible.length) return null;
  const remaining = Math.max(0, (count ?? students.length) - visible.length);

  return (
    <div className="absolute bottom-4 right-4 z-20 flex w-fit items-center -space-x-2" aria-label="Students in this class">
      {visible.map((student) => (
        <Tooltip key={student.id}>
          <TooltipTrigger asChild>
            <span tabIndex={0} role="img" aria-label={`Student: ${student.name}`} title={student.name}
              className="relative cursor-default rounded-full outline-none transition-transform hover:z-10 hover:-translate-y-1 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent">
              <Avatar className="size-9 border-2 border-white shadow-sm">
                <AvatarImage src={student.imageUrl ?? undefined} alt="" className="object-cover" />
                <AvatarFallback className={cn("text-xs font-semibold", studentThumbnailColor(student.id))}>{getInitials(student.name)}</AvatarFallback>
              </Avatar>
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={8} className="max-w-[calc(100vw-2rem)] [overflow-wrap:anywhere]">{student.name}</TooltipContent>
        </Tooltip>
      ))}
      {remaining > 0 && <span className="relative flex size-9 items-center justify-center rounded-full border-2 border-white bg-white text-xs font-semibold text-slate-700 shadow-sm" title={`${remaining} more students`} aria-label={`${remaining} more students`}>+{remaining}</span>}
    </div>
  );
}

export function ClassroomClassGrid({ classes, role }: { classes: ClassroomCardData[]; role: "teacher" | "student" }) {
  const searchId = useId();
  const yearId = useId();
  const semesterId = useId();
  const levelId = useId();
  const [query, setQuery] = useState("");
  const [schoolYear, setSchoolYear] = useState("");
  const [semester, setSemester] = useState("");
  const [yearLevel, setYearLevel] = useState("");
  const schoolYears = [...new Set(classes.map((assignedClass) => assignedClass.schoolYear))].sort((a, b) => b.localeCompare(a));
  const yearLevels = academicLevelOptions.filter((level) => classes.some((assignedClass) => assignedClass.yearLevel === level.value));
  const hasUnassignedSemester = classes.some((assignedClass) => !assignedClass.semester);
  const hasFilters = Boolean(query.trim() || schoolYear || semester || yearLevel);
  const searchTerms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const filteredClasses = classes.filter((assignedClass) => {
    if (schoolYear && assignedClass.schoolYear !== schoolYear) return false;
    if (semester && (semester === "unassigned" ? assignedClass.semester != null : assignedClass.semester !== semester)) return false;
    if (yearLevel && assignedClass.yearLevel !== yearLevel) return false;
    const searchable = [assignedClass.subjectName, assignedClass.sectionName, assignedClass.schoolYear,
      assignedClass.branchTitle, assignedClass.teacherName, formatAcademicLevel(assignedClass.yearLevel), formatSemester(assignedClass.semester)].filter(Boolean).join(" ").toLocaleLowerCase();
    return searchTerms.every((term) => searchable.includes(term));
  });

  function clearFilters() {
    setQuery("");
    setSchoolYear("");
    setSemester("");
    setYearLevel("");
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
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:min-w-56 sm:flex-1">
            <label htmlFor={searchId} className="sr-only">Search my classes</label>
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id={searchId} role="searchbox" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your classes..." className="h-10 rounded-lg bg-card pl-9 pr-10" />
            {query && <Button type="button" variant="ghost" size="icon-sm" aria-label="Clear search" className="absolute right-1 top-1/2 -translate-y-1/2" onClick={() => setQuery("")}><X aria-hidden="true" /></Button>}
          </div>
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
        </div>
        <div className="flex min-h-8 flex-wrap items-center justify-between gap-3">
          <p role="status" className="text-sm text-muted-foreground">{filteredClasses.length} {filteredClasses.length === 1 ? "class" : "classes"}{hasFilters ? ` of ${classes.length}` : ""}</p>
          {hasFilters && <Button type="button" variant="ghost" size="sm" onClick={clearFilters}><X aria-hidden="true" />Clear filters</Button>}
        </div>
      </div>
      {filteredClasses.length ? (
        <TooltipProvider delayDuration={200}>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredClasses.map((assignedClass) => (
            <article key={assignedClass.id} className="group relative isolate flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:border-primary/40 hover:shadow-md">
              <Link href={assignedClass.href} aria-label={`Open ${assignedClass.subjectName}, ${assignedClass.sectionName}`} className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" />
              <div className={cn("relative min-h-44 overflow-hidden p-6 text-white", classCoverTheme(assignedClass.id))}>
                <ClassCoverDecoration />
                <div className="relative">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-white/90">{assignedClass.schoolYear}</p>
                  <h2 className="break-words text-2xl font-semibold leading-8 tracking-tight">{assignedClass.subjectName}</h2>
                  <p className="mt-2 break-words text-sm text-white/90">{assignedClass.sectionName}</p>
                </div>
                <StudentThumbnails students={assignedClass.studentPreviews} count={assignedClass.studentCount} />
              </div>
              <div className="flex flex-1 flex-col gap-3 px-6 py-5">
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
          ))}
        </div>
        </TooltipProvider>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <h2 className="font-semibold">No classes match your filters</h2>
          <p className="mt-2 text-sm text-muted-foreground">Try another search, school year, semester, or year level.</p>
          <Button type="button" variant="outline" className="mt-5" onClick={clearFilters}>Clear filters</Button>
        </div>
      )}
    </section>
  );
}
