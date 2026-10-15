import { ClipboardList, FileText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ClassworkCatalogResult } from "@/lib/classes/spreadsheet";

function isBelowPassingScore(score: string | null | undefined, maxScore: number): boolean {
  if (typeof score !== "string" || !Number.isFinite(maxScore) || maxScore <= 0) return false;
  const value = score.trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) return false;
  const earnedPoints = Number(value);
  // Allow floating-point noise at the exact 75% boundary (for example, 0.15 / 0.2).
  return Number.isFinite(earnedPoints) && earnedPoints / maxScore < 0.75 - Number.EPSILON;
}

export function ClassworkView({ result, role, refreshHref }: {
  result: ClassworkCatalogResult | null;
  role: "teacher" | "student";
  refreshHref: string;
}) {
  const periods = result?.success ? result.periods.filter((period) => period.categories.some((category) => category.activities.length > 0)) : [];
  const activityCount = periods.reduce((count, period) => count + period.categories.reduce((total, category) => total + category.activities.length, 0), 0);

  return (
    <section className="min-w-0 space-y-6" aria-label="Classwork">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">Classwork</h2>
          <p className="mt-1 text-sm text-muted-foreground">{role === "teacher" ? "Activities and points from your class spreadsheet." : "Class activities and your scores from the class spreadsheet."}</p>
        </div>
        {result && <Button asChild variant="outline" size="sm"><a href={refreshHref}><RefreshCw aria-hidden="true" />Refresh classwork</a></Button>}
      </div>
      {!result ? (
        <div className="rounded-2xl border border-dashed bg-card px-6 py-16 text-center">
          <ClipboardList aria-hidden="true" className="mx-auto mb-4 size-8 text-muted-foreground" />
          <h3 className="font-semibold">Your classwork will appear here</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{role === "teacher" ? "Add your Google Sheets link in Overview to load this class's activities." : "Your teacher has not connected this class to its spreadsheet yet."}</p>
        </div>
      ) : !result.success ? (
        <div role="status" className="rounded-2xl border bg-card p-6">
          <h3 className="font-semibold">Classwork unavailable</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{result.message}</p>
        </div>
      ) : activityCount === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card px-6 py-16 text-center">
          <ClipboardList aria-hidden="true" className="mx-auto mb-4 size-8 text-muted-foreground" />
          <h3 className="font-semibold">No classwork yet</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{role === "teacher" ? "No activities are available in this spreadsheet. Add them to a grading period, then refresh classwork." : "Your teacher has not posted any activities for this class yet."}</p>
        </div>
      ) : (
        <div className="grid min-w-0 gap-6 lg:grid-cols-[12rem_minmax(0,1fr)]">
          <aside className="min-w-0">
            <nav aria-label="Classwork periods" className="rounded-xl border bg-card p-3 lg:sticky lg:top-36">
              <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Grading periods</p>
              <div className="flex flex-wrap gap-1 lg:flex-col">
                {periods.map(({ period }) => <a key={period} href={`#classwork-${period.toLowerCase()}`} className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-primary/5 hover:text-primary focus-visible:outline-2 focus-visible:outline-ring">{period}</a>)}
              </div>
            </nav>
            <p className="mt-3 px-3 text-xs text-muted-foreground">{activityCount} {activityCount === 1 ? "activity" : "activities"}</p>
          </aside>
          <div className="min-w-0 space-y-8">
            {periods.map(({ period, categories }) => (
              <section key={period} id={`classwork-${period.toLowerCase()}`} className="min-w-0 scroll-mt-36" aria-label={`${period} classwork`}>
                <h3 className="mb-4 border-b-2 border-primary/20 pb-3 text-xl font-medium text-primary">{period}</h3>
                <div className="space-y-4">
                  {categories.filter((category) => category.activities.length > 0).map((category, categoryIndex) => (
                    <section key={`${category.name}-${categoryIndex}`} className="min-w-0 overflow-hidden rounded-xl border bg-card shadow-sm" aria-label={`${period} ${category.name}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/25 px-4 py-3 sm:px-5">
                        <h4 className="min-w-0 text-sm font-semibold [overflow-wrap:anywhere]">{category.name}</h4>
                        {category.weight !== null && <span className="shrink-0 rounded-full border bg-background px-2.5 py-1 text-xs text-muted-foreground">{category.weight}% of grade</span>}
                      </div>
                      <ul className="divide-y">
                        {category.activities.map((activity, activityIndex) => (
                          <li key={`${activity.name}-${activityIndex}`} className="flex min-w-0 items-center gap-3 px-4 py-4 sm:gap-4 sm:px-5">
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><FileText aria-hidden="true" className="size-4" /></div>
                            <div className="min-w-0 flex-1">
                              <h5 className="text-sm font-medium [overflow-wrap:anywhere]">{activity.name}</h5>
                              <p className="mt-1 text-xs text-muted-foreground">{activity.maxScore} {activity.maxScore === 1 ? "point" : "points"}{role === "teacher" && activity.isExcludable && <span className="ml-2 rounded bg-muted px-1.5 py-0.5">Marked for exclusion</span>}</p>
                            </div>
                            {role === "student" && <div className="min-w-0 max-w-[40%] shrink-0 text-right"><p className="text-xs text-muted-foreground">Your score</p><p className="mt-1 text-sm font-semibold [overflow-wrap:anywhere]"><span className={isBelowPassingScore(activity.score, activity.maxScore) ? "text-red-600 dark:text-red-400" : undefined}>{activity.score ?? "Not graded"}</span>{activity.score !== undefined && activity.score !== null && <span className="font-normal text-muted-foreground"> / {activity.maxScore}</span>}</p></div>}
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
