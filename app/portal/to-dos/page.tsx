import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, ClipboardCheck, Clock3, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth";
import { formatSemester } from "@/lib/academic-levels";
import { getStudentTodos } from "@/lib/classes/student-todos";

export default async function StudentTodosPage() {
  const session = await requireSession();
  if (session.role !== "student") redirect("/portal");
  const report = await getStudentTodos();
  const pendingClasses = report.classes.flatMap((assignedClass) => {
    if (!assignedClass.classwork.success) return [];
    const tasks = assignedClass.classwork.periods.flatMap(({ period, categories }) =>
      categories.flatMap((category, categoryIndex) => category.activities.map((activity, activityIndex) => ({
        activity, period, category: category.name, key: `${period}-${categoryIndex}-${activityIndex}`,
      }))));
    return tasks.length ? [{ assignedClass, tasks }] : [];
  });
  const unavailable = report.classes.flatMap((assignedClass) => assignedClass.classwork.success ? [] : [{
    id: assignedClass.id, subjectName: assignedClass.subjectName, message: assignedClass.classwork.message,
  }]);

  return (
    <main className="mx-auto flex w-full min-w-0 max-w-5xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">To-dos</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Activities without a recorded score from your ongoing classes.</p>
        </div>
        <Button asChild variant="outline" size="sm" className="rounded-xl bg-card shadow-none"><a href="/portal/to-dos"><RefreshCw aria-hidden="true" />Refresh</a></Button>
      </header>
      {report.message ? <div role="status" className="rounded-2xl border bg-card p-5 text-sm">{report.message}</div> : (
        <>
          {!pendingClasses.length ? <section className="rounded-2xl border bg-card px-6 py-14 text-center">
            <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"><ClipboardCheck aria-hidden="true" className="size-6" /></span>
            <h2 className="font-semibold">{report.classes.length ? "No ungraded tasks" : "No ongoing classes"}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{!report.classes.length ? "Tasks will appear here when you are enrolled in an ongoing class."
              : unavailable.length ? "No ungraded tasks were found in the classwork that could be loaded. Check the classwork notices below."
                : "There are no ungraded activities in the classwork available to you."}</p>
          </section> : pendingClasses.map(({ assignedClass, tasks }) => (
            <section key={assignedClass.id} aria-label={`${assignedClass.subjectName} to-dos`} className="min-w-0 overflow-hidden rounded-2xl border bg-card">
              <header className="flex min-w-0 items-center justify-between gap-3 border-b bg-violet-50/40 px-4 py-4 sm:px-5 dark:bg-violet-950/20">
                <Link href={`/portal/classroom/${assignedClass.id}?tab=classwork`} className="min-w-0 rounded-md focus-visible:outline-2 focus-visible:outline-ring">
                  <h2 className="wrap-anywhere text-sm font-semibold leading-6 text-violet-800 dark:text-violet-300">{assignedClass.subjectName}</h2>
                  <p className="mt-1 wrap-anywhere text-xs leading-5 text-muted-foreground">{assignedClass.classCode} · {assignedClass.sectionName} · {assignedClass.schoolYear} / {formatSemester(assignedClass.semester)}</p>
                </Link>
                <span className="shrink-0 text-xs text-muted-foreground">{tasks.length} {tasks.length === 1 ? "task" : "tasks"}</span>
              </header>
              <ul className="divide-y divide-border/60">
                {tasks.map(({ activity, period, category, key }) => (
                  <li key={key}>
                    <Link href={`/portal/classroom/${assignedClass.id}?tab=classwork#classwork-${period.toLowerCase()}`}
                      className="group flex min-w-0 items-center gap-3 px-4 py-4 transition-colors hover:bg-muted/35 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring motion-reduce:transition-none sm:px-5">
                      <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-50/70 text-[#9a6b45] dark:bg-amber-950/25 dark:text-[#d8ad86]"><Clock3 className="size-4" /></span>
                      <div className="min-w-0 flex-1">
                        <h3 className="wrap-anywhere text-sm font-medium leading-6">{activity.name}</h3>
                        <p className="mt-0.5 wrap-anywhere text-xs leading-5 text-muted-foreground">{period} · {category}{activity.maxScore !== null && <> · {activity.maxScore} {activity.maxScore === 1 ? "point" : "points"}</>}</p>
                      </div>
                      <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {unavailable.length > 0 && <details className="rounded-xl border bg-card px-4 py-3">
            <summary className="cursor-pointer rounded-sm text-sm font-medium text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring">Some classwork is unavailable ({unavailable.length})</summary>
            <ul className="mt-4 space-y-4 border-t pt-4">
              {unavailable.map((assignedClass) => <li key={assignedClass.id} className="min-w-0">
                <Link href={`/portal/classroom/${assignedClass.id}?tab=classwork`} className="wrap-anywhere rounded-sm text-sm font-medium text-violet-800 focus-visible:outline-2 focus-visible:outline-ring dark:text-violet-300">{assignedClass.subjectName}</Link>
                <p className="mt-1 wrap-anywhere text-xs leading-5 text-muted-foreground">{assignedClass.message}</p>
              </li>)}
            </ul>
          </details>}
        </>
      )}
    </main>
  );
}
