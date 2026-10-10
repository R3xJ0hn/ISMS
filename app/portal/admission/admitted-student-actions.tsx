"use client";

import Link from "next/link";
import { Eye, Pencil } from "lucide-react";
import { useState } from "react";

import { AdmissionReviewDetails } from "@/app/(public)/admission/components/review-step";
import { AdmissionModal } from "@/app/portal/admission/admission-ui";
import { getAdmittedStudentDetails } from "@/app/portal/admission/actions";
import type { AdmittedStudentPayload } from "@/lib/admission/records";
import { Button } from "@/components/ui/button";

export type PortalAdmittedStudentRecord = AdmittedStudentPayload;
export type PortalAdmittedStudentSummary = Pick<AdmittedStudentPayload, "applicationId" | "firstName" | "lastName">;

export function AdmittedStudentActions({ student }: { student: PortalAdmittedStudentSummary }) {
  const [viewOpen, setViewOpen] = useState(false);
  const [details, setDetails] = useState<PortalAdmittedStudentRecord | null>(null);
  const [detailsError, setDetailsError] = useState("");
  const [loadingDetails, setLoadingDetails] = useState(false);

  async function loadDetails() {
    if (details || loadingDetails) return;
    setLoadingDetails(true);
    setDetailsError("");
    try {
      setDetails(await getAdmittedStudentDetails(student.applicationId));
    } catch (error) {
      console.error("Failed to load admitted student details:", error);
      setDetailsError("Student details could not be loaded.");
    } finally {
      setLoadingDetails(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <AdmissionModal
        open={viewOpen}
        onOpenChange={(open) => {
          setViewOpen(open);
          if (open) void loadDetails();
        }}
        trigger={<Button type="button" variant="outline" size="icon-sm" aria-label="View student"><Eye /></Button>}
        title="View Student"
        description={`${student.firstName} ${student.lastName}`}
        wide
      >
        <div className="overflow-y-auto p-5">
          {details ? (
            <AdmissionReviewDetails form={details.reviewForm} showConsent={false} className="max-h-none" />
          ) : (
            <p className="text-sm text-muted-foreground">
              {loadingDetails ? "Loading student details..." : detailsError || "Student details are unavailable."}
            </p>
          )}
        </div>
      </AdmissionModal>
      <Button asChild variant="outline" size="icon-sm" aria-label="Edit student">
        <Link href={`/portal/admission/${student.applicationId}/edit`}><Pencil /></Link>
      </Button>
    </div>
  );
}
