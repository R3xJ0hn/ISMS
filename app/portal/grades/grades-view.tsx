"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { BookOpenCheck, ChevronDown } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";

type GradesViewProps = {
  semester: string;
  displayName: string;
  studentNumber: string | null;
  children: ReactNode;
};

function GradesTableSkeleton({ semester }: { semester: string }) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground">
            {semester === "1stSem" ? "1st Semester" : "2nd Semester"}
          </h2>
          <span className="text-xs font-medium text-muted-foreground">
            Loading grades...
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-240">
          <div className="grid grid-cols-[0.8fr_2.4fr_repeat(9,0.8fr)] gap-4 border-b border-border bg-muted/50 px-4 py-3">
            {Array.from({ length: 11 }).map((_, index) => (
              <Skeleton key={index} className="h-4 w-full" />
            ))}
          </div>
          {Array.from({ length: 7 }).map((_, rowIndex) => (
            <div
              key={rowIndex}
              className="grid grid-cols-[0.8fr_2.4fr_repeat(9,0.8fr)] gap-4 border-b border-border px-4 py-4 last:border-b-0"
            >
              {Array.from({ length: 11 }).map((_, columnIndex) => (
                <Skeleton
                  key={columnIndex}
                  className={columnIndex === 1 ? "h-4 w-full" : "h-4 w-16"}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function GradesView({
  semester,
  displayName,
  studentNumber,
  children,
}: GradesViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedSemester, setSelectedSemester] = useState(semester);

  useEffect(() => {
    setSelectedSemester(semester);
  }, [semester]);

  return (
    <>
      <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between md:p-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <BookOpenCheck className="size-4" />
            Student Grades
          </div>
          <h1 className="mt-2 truncate text-2xl font-semibold tracking-normal text-foreground">
            {displayName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Student No. {studentNumber ?? "Not assigned"}
          </p>
        </div>

        <div className="flex min-w-48 items-center gap-2">
          <label htmlFor="semester" className="text-sm font-medium text-foreground">
            Semester
          </label>
          <div className="relative">
            <select
              id="semester"
              name="semester"
              value={selectedSemester}
              disabled={isPending}
              onChange={(event) => {
                const nextSemester = event.target.value;
                setSelectedSemester(nextSemester);

                startTransition(() => {
                  router.push(`/portal/grades?semester=${nextSemester}`);
                });
              }}
              className="h-10 appearance-none rounded-md border border-input bg-background px-3 pr-9 text-sm font-medium text-foreground shadow-xs outline-none transition disabled:cursor-wait disabled:opacity-70 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <option value="1stSem">1st Semester</option>
              <option value="2ndSem">2nd Semester</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>
      </section>

      {isPending ? <GradesTableSkeleton semester={selectedSemester} /> : children}
    </>
  );
}
