import { ChevronDown, CircleAlert, ClipboardList, FileText, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ClassworkCatalogResult } from "@/lib/classes/spreadsheet";
import { isAdditionalPointsActivity } from "@/lib/classes/presentation";
import { parseClassworkNote } from "@/lib/classes/classwork-notes";

const periodColors = {
  Prelim: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  Midterm: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  Prefinals: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  Finals: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
} as const;

function ClassworkPlaceholder({ title, description, unavailable = false }: {
  title: string; description: string; unavailable?: boolean;
}) {
  const Icon = unavailable ? CircleAlert : ClipboardList;
  return (
    <div role={unavailable ? "status" : undefined} className="rounded-2xl border border-dashed bg-card px-6 py-16 text-center sm:py-20">
      <span className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl border bg-muted/40 text-muted-foreground"><Icon aria-hidden="true" className="size-6" /></span>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mx-auto mt-2 max-w-md wrap-anywhere text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}

function isBelowPassingScore(score: string | null | undefined, maxScore: number | null): boolean {
  if (typeof score !== "string" || typeof maxScore !== "number" || !Number.isFinite(maxScore) || maxScore <= 0) return false;
  const value = score.trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) return false;
  const earnedPoints = Number(value);
  // Allow floating-point noise at the exact 75% boundary (for example, 0.15 / 0.2).
  return Number.isFinite(earnedPoints) && earnedPoints / maxScore < 0.75 - Number.EPSILON;
}

export function ClassworkView({ result, role, refreshHref, studentName }: {
  result: ClassworkCatalogResult | null;
  role: "teacher" | "student";
  refreshHref: string;
  studentName?: string;
}) {
  const periods = result?.success ? result.periods.map((period) => ({ ...period, categories: period.categories.map((category) => ({
    ...category, activities: category.activities.map((activity) => activity.isAdditionalPoints || isAdditionalPointsActivity(activity.name)
      ? { ...activity, isAdditionalPoints: true, maxScore: null } : activity).filter((activity) => !activity.isAdditionalPoints ||
      (role === "student" && typeof activity.score === "string" && activity.score.trim() !== "")),
  })) })).filter((period) => (role === "student" && period.note?.trim()) || period.categories.some((category) => category.activities.length > 0)) : [];

  return (
    <section className="min-w-0 space-y-7" aria-label="Classwork">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold tracking-tight">Classwork</h2>
          <p className="mt-2 max-w-xl wrap-anywhere text-sm leading-6 text-muted-foreground">{studentName ? `Class activities and scores for ${studentName}.` : role === "teacher" ? "Activities and points from your class spreadsheet." : "Class activities and your scores from the class spreadsheet."}</p>
        </div>
        {result && <Button asChild variant="outline" size="sm" className="rounded-xl bg-card shadow-none"><a href={refreshHref}><RefreshCw aria-hidden="true" />Refresh classwork</a></Button>}
      </div>
      {!result ? (
        <ClassworkPlaceholder title="Your classwork will appear here" description={role === "teacher" ? "Add your Google Sheets link in Overview to load this class's activities." : "Your teacher has not connected this class to its spreadsheet yet."} />
      ) : !result.success ? (
        <ClassworkPlaceholder title="Classwork unavailable" description={result.message} unavailable />
      ) : periods.length === 0 ? (
        <ClassworkPlaceholder title="No classwork yet" description={role === "teacher" ? "No activities are available in this spreadsheet. Add them to a grading period, then refresh classwork." : "Your teacher has not posted any activities for this class yet."} />
      ) : (
        <div className="min-w-0 space-y-12">
          {periods.map(({ period, categories, note }) => (
            <details open key={period} id={`classwork-${period.toLowerCase()}`} className="group/quarter min-w-0 scroll-mt-36" aria-label={`${period} classwork`}>
              <summary className={`flex min-w-0 cursor-pointer list-none items-center gap-3 rounded-r-lg border-l-[3px] border-current px-3 py-3 outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-4 [&::-webkit-details-marker]:hidden ${periodColors[period]}`}>
                <h3 className="min-w-0 flex-1 text-base font-semibold tracking-tight sm:text-lg">{period}</h3>
                <ChevronDown aria-hidden="true" className="size-4 shrink-0 transition-transform group-open/quarter:rotate-180" />
              </summary>
              <div className="space-y-7 pt-5">
                {role === "student" && note?.trim() && (
                  <details aria-label={`${period} teacher note`} className="group mx-3 min-w-0 rounded-md border border-violet-200/70 bg-violet-50/50 sm:mx-5 dark:border-violet-900 dark:bg-violet-950/20">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-md p-4 text-sm text-violet-800 outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-violet-300 [&::-webkit-details-marker]:hidden">
                      <span className="min-w-0 flex-1">
                        <span className="font-semibold">Teacher’s note</span>
                        <span className="mt-1 flex min-w-0 items-baseline text-xs font-normal text-muted-foreground group-open:hidden">
                          <span className="min-w-0 overflow-hidden whitespace-nowrap">{parseClassworkNote(note).map((part) => part.title ? `${part.title}: ${part.text}` : part.text).join(" · ").replace(/\s+/g, " ")}</span>
                          <span className="shrink-0 whitespace-nowrap text-violet-700 dark:text-violet-300">... See more</span>
                        </span>
                      </span>
                      <ChevronDown aria-hidden="true" className="size-4 shrink-0 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="space-y-3 px-4 pb-4">
                      {parseClassworkNote(note).map((part, index) => (
                        <div key={index} className="min-w-0 whitespace-pre-wrap text-sm leading-6 wrap-anywhere">
                          {part.title && <p className="font-semibold">{part.title}</p>}
                          <p className="text-muted-foreground">{part.text}</p>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
                {categories.filter((category) => category.activities.length > 0).map((category, categoryIndex) => (
                  <section key={`${category.name}-${categoryIndex}`} className="min-w-0" aria-label={`${period} ${category.name}`}>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <h4 className="min-w-0 text-sm font-semibold [overflow-wrap:anywhere]">{category.name}</h4>
                      {category.weight !== null && <span className="shrink-0 rounded-md border border-border/70 bg-card px-2 py-1 text-[11px] font-medium text-muted-foreground">{category.weight}% of grade</span>}
                    </div>
                    <div className="ml-2 min-w-0 border-l-2 border-slate-300 pl-5 sm:ml-3 sm:pl-8 dark:border-slate-600">
                    <table className="w-full table-fixed border-collapse text-left text-sm">
                      <caption className="sr-only">{period} {category.name} activities</caption>
                      <thead>
                        <tr className="border-b">
                          <th scope="col" className="py-2 pr-3 text-xs font-medium text-muted-foreground">Activity</th>
                          {role === "student" && <th scope="col" className="w-[36%] py-2 pl-2 text-right text-xs font-medium text-muted-foreground">{studentName ? "Student score" : "Your score"}</th>}
                        </tr>
                      </thead>
                      <tbody>
                      {category.activities.map((activity, activityIndex) => {
                        const score = activity.score?.trim() || null;
                        const Icon = activity.isAdditionalPoints ? Sparkles : FileText;
                        return <tr key={`${activity.name}-${activityIndex}`} className="border-b">
                          <td className="relative py-3 pr-3 align-middle before:absolute before:top-1/2 before:-left-[22px] before:w-5 before:border-t-2 before:border-slate-300 sm:before:-left-[34px] sm:before:w-8 dark:before:border-slate-600">
                          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                            <span className={`flex size-8 shrink-0 items-center justify-center rounded-xl sm:size-9 ${activity.isAdditionalPoints ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-muted/70 text-muted-foreground"}`}><Icon aria-hidden="true" className="size-4" /></span>
                            <div className="min-w-0 flex-1">
                              <h5 className="text-sm font-semibold leading-5 [overflow-wrap:anywhere]">{activity.name}</h5>
                              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{activity.isAdditionalPoints ? "Added to Performance Task %" : <>{activity.maxScore} {activity.maxScore === 1 ? "point" : "points"}</>}{role === "teacher" && activity.isExcludable && <span className="ml-2 inline-block rounded-md border bg-muted/50 px-1.5 py-0.5">Marked for exclusion</span>}</p>
                            </div>
                          </div>
                          </td>
                          {role === "student" && <td className="py-3 pl-2 text-right align-middle">
                            <p className="font-semibold tabular-nums [overflow-wrap:anywhere]"><span className={score === null ? "text-[#9a6b45] dark:text-[#d8ad86]" : !activity.isAdditionalPoints && isBelowPassingScore(score, activity.maxScore) ? "text-red-600 dark:text-red-400" : undefined}>{score ?? "Not graded"}</span>{!activity.isAdditionalPoints && score !== null && <span className="font-normal text-muted-foreground"> / {activity.maxScore}</span>}</p>
                          </td>}
                        </tr>;
                      })}
                      </tbody>
                    </table>
                    </div>
                  </section>
                ))}
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
