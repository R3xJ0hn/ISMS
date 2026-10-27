import { ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ClassRosterCrossMatchResult } from "@/lib/classes/roster-comparison";
import { cn } from "@/lib/utils";
import { RosterCrossMatchTable } from "./roster-cross-match-table";

export function RosterCrossMatchView({ result, enrolledCount, connected, spreadsheetUrl, refreshHref }: {
  result: ClassRosterCrossMatchResult | null;
  enrolledCount: number;
  connected: boolean;
  spreadsheetUrl: string | null;
  refreshHref: string;
}) {
  const needsAttention = result?.success && (result.comparison.missingStudents.length > 0 ||
    result.comparison.rows.some((row) => row.issues.some((issue) => issue !== "name_mismatch")));

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">Google Sheets and database cross-match</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Compare the connected sheet&apos;s INPUT student roster with database records and this class&apos;s enrollment. This comparison does not change either list.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><a href={refreshHref}><RefreshCw aria-hidden="true" />Refresh</a></Button>
          {spreadsheetUrl && <Button asChild variant="outline"><a href={spreadsheetUrl} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden="true" />Open spreadsheet</a></Button>}
        </div>
      </div>
      {result?.success ? <>
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Cross-match summary">
          {[
            { label: "Sheet rows", value: result.comparison.rows.length },
            { label: "Enrolled students", value: enrolledCount },
            { label: "Matched", value: result.comparison.matchedCount },
            { label: "Needs review", value: result.comparison.issueCount },
          ].map(({ label, value }) => <div key={label} className="rounded-xl border border-border bg-card p-4"><dt className="text-xs text-muted-foreground">{label}</dt><dd className={cn("mt-1 text-2xl font-semibold", label === "Needs review" && value > 0 && (needsAttention ? "text-red-700" : "text-amber-700"))}>{value}</dd></div>)}
        </dl>
        <p className="text-xs text-muted-foreground">Needs review counts each flagged sheet row once, plus enrolled students missing from the sheet.</p>
        <RosterCrossMatchTable comparison={result.comparison} profiles={result.profiles} />
      </> : <section role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        <h2 className="font-semibold">{connected ? "Unable to compare student lists" : "No Google Sheet connected"}</h2>
        <p className="mt-2">{result?.message ?? "Please refresh to compare the student lists."}</p>
      </section>}
    </div>
  );
}
