"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ClassRosterReviewReport } from "@/lib/classes/roster-review";
import { getClassRosterReviewAction } from "./actions";

const unavailableMessage = "Unable to check class rosters right now. Please try again.";

function isReport(value: unknown): value is ClassRosterReviewReport {
  if (!value || typeof value !== "object" || !("checkedAt" in value) || !("classes" in value) ||
    typeof value.checkedAt !== "string" || !Number.isFinite(Date.parse(value.checkedAt)) || !Array.isArray(value.classes)) return false;
  const ids = new Set<string>();
  return value.classes.every((row: unknown) => {
    if (!row || typeof row !== "object") return false;
    const item = row as Record<string, unknown>;
    if (typeof item.id !== "string" || !/^[1-9]\d*$/.test(item.id) ||
      !["classCode", "subjectName", "sectionName", "schoolYear", "teacherName"].every((key) => typeof item[key] === "string") ||
      ![null, "FirstSemester", "SecondSemester"].includes(item.semester as string | null) ||
      !["needs_review", "matched", "unavailable", "not_connected"].includes(String(item.state)) ||
      ![null, "warning", "attention"].includes(item.severity as string | null) ||
      !(item.message === null || typeof item.message === "string") ||
      !(item.checkedAt === null || (typeof item.checkedAt === "string" && Number.isFinite(Date.parse(item.checkedAt))))) return false;
    if (ids.has(item.id)) return false;
    ids.add(item.id);
    const counts = [item.issueCount, item.issueRows, item.missingStudents, item.nameDifferences];
    if (item.state === "unavailable" || item.state === "not_connected") return counts.every((count) => count === null) && item.severity === null;
    if (!counts.every((count) => typeof count === "number" && Number.isSafeInteger(count) && count >= 0)) return false;
    if (item.state === "matched") return counts.every((count) => count === 0) && item.severity === null;
    return (item.issueCount as number) > 0 && item.issueCount === (item.issueRows as number) + (item.missingStudents as number) &&
      (item.nameDifferences as number) <= (item.issueRows as number) &&
      (item.severity === "attention" || (item.severity === "warning" && item.missingStudents === 0 && item.nameDifferences === item.issueRows));
  });
}

/** Both management screens load the same protected report without delaying their page content. */
export function useClassRosterReviews() {
  const [report, setReport] = useState<ClassRosterReviewReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const request = useRef({ sequence: 0 });

  const load = useCallback(async (refresh = false) => {
    const sequence = ++request.current.sequence;
    let message = unavailableMessage;
    try {
      const payload: unknown = await getClassRosterReviewAction(refresh);
      if (sequence !== request.current.sequence) return;
      if (payload && typeof payload === "object" && "success" in payload && payload.success === false &&
          "reason" in payload && payload.reason === "unauthorized") {
        message = "Your session no longer has access to class reviews. Please sign in again.";
      }
      if (!payload || typeof payload !== "object" || !("success" in payload) || payload.success !== true ||
        !("report" in payload) || !isReport(payload.report)) throw new Error("Incomplete report");
      setReport(payload.report);
      setError(null);
    } catch {
      if (sequence === request.current.sequence) setError(message);
    } finally {
      if (sequence === request.current.sequence) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const currentRequest = request.current;
    let active = true;
    void Promise.resolve().then(() => { if (active) return load(); });
    return () => { active = false; currentRequest.sequence++; };
  }, [load]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    await load(true);
  }, [load]);

  return { report, loading, error, refresh };
}
