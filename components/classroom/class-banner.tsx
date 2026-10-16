import { Building2, CalendarDays, GraduationCap, UserRound } from "lucide-react";
import { formatAcademicLevel, formatSemester } from "@/lib/academic-levels";
import type { AcademicLevel, Semester } from "@/lib/generated/prisma/enums";
import { cn } from "@/lib/utils";
import { classCoverTheme } from "@/lib/portal/classroom-colors";

export { classCoverTheme };

export function ClassCoverDecoration() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -right-12 -top-20 size-72 rounded-full border-[36px] border-white/10" />
      <div className="absolute -bottom-32 right-12 size-64 rotate-12 rounded-[3rem] bg-white/5" />
      <div className="absolute right-28 top-12 size-5 rounded-full bg-white/15" />
    </div>
  );
}

export function ClassBanner({ classId, subjectName, sectionName, schoolYear, semester, yearLevel, branchTitle, teacherName }: {
  classId: string;
  subjectName: string;
  sectionName: string;
  schoolYear: string;
  semester?: Semester | null;
  yearLevel: AcademicLevel;
  branchTitle: string | null;
  teacherName?: string;
}) {
  return (
    <section className={cn("relative isolate overflow-hidden rounded-2xl px-6 py-7 text-white sm:px-8 sm:py-9", classCoverTheme(classId))} aria-label="Class details">
      <ClassCoverDecoration />
      <div className="relative flex min-h-36 flex-col justify-between gap-8">
        <div className="min-w-0 max-w-3xl">
          <p className="mb-2 text-sm font-medium text-white/90 [overflow-wrap:anywhere]">{sectionName} <span aria-hidden="true">·</span> {formatAcademicLevel(yearLevel)}</p>
          <h1 className="break-words text-3xl font-semibold tracking-tight sm:text-4xl">{subjectName}</h1>
          {teacherName && <p className="mt-3 flex min-w-0 items-center gap-2 text-sm text-white/90"><UserRound aria-hidden="true" className="size-4 shrink-0" /><span className="min-w-0 [overflow-wrap:anywhere]">{teacherName}</span></p>}
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/90">
          <span className="inline-flex items-center gap-2"><CalendarDays aria-hidden="true" className="size-4" />{schoolYear}</span>
          <span>{formatSemester(semester)}</span>
          <span className="inline-flex min-w-0 max-w-full items-center gap-2"><Building2 aria-hidden="true" className="size-4 shrink-0" /><span className="min-w-0 [overflow-wrap:anywhere]">{branchTitle ?? "Branch not assigned"}</span></span>
          <GraduationCap aria-hidden="true" className="ml-auto hidden size-8 text-white/60 sm:block" />
        </div>
      </div>
    </section>
  );
}
