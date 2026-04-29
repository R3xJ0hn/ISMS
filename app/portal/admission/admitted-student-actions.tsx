"use client";

import Link from "next/link";
import { Eye, Pencil, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  AdmissionReviewDetails,
  type ReviewFormValues,
} from "@/app/(public)/admission/components/review-step";
import { getAdmittedStudentDetails } from "@/app/portal/admission/detail-actions";
import { Button } from "@/components/ui/button";

export type PortalAdmittedStudentRecord = {
  applicationId: string;
  studentId: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  middleName: string;
  suffix: string;
  birthDate: string;
  gender: string;
  civilStatus: string;
  citizenship: string;
  birthplace: string;
  religion: string;
  email: string;
  phone: string;
  facebookAccount: string;
  addressHouseNumber: string;
  addressSubdivision: string;
  addressStreet: string;
  addressBarangay: string;
  addressCity: string;
  addressProvince: string;
  addressPostalCode: string;
  guardianFirstName: string;
  guardianLastName: string;
  guardianMiddleName: string;
  guardianSuffix: string;
  guardianRelationship: string;
  guardianContactNumber: string;
  guardianOccupation: string;
  lastSchoolName: string;
  lastSchoolId: string;
  lastSchoolShortName: string;
  lastSchoolType: string;
  lastSchoolHouseNumber: string;
  lastSchoolSubdivision: string;
  lastSchoolStreet: string;
  lastSchoolBarangay: string;
  lastSchoolCity: string;
  lastSchoolProvince: string;
  lastSchoolPostalCode: string;
  lastSchoolYear: string;
  lastSchoolGraduationDate: string;
  lastSchoolYearLevel: string;
  reviewForm: ReviewFormValues;
};

export type PortalAdmittedStudentSummary = {
  applicationId: string;
  firstName: string;
  lastName: string;
};

export function AdmittedStudentActions({
  student,
}: {
  student: PortalAdmittedStudentSummary;
}) {
  const [viewOpen, setViewOpen] = useState(false);
  const [details, setDetails] = useState<PortalAdmittedStudentRecord | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const viewButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!viewOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const triggerElement = viewButtonRef.current;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setViewOpen(false);
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      );

      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      triggerElement?.focus();
    };
  }, [viewOpen]);

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          ref={viewButtonRef}
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={async () => {
            setViewOpen(true);

            if (details || loadingDetails) {
              return;
            }

            setLoadingDetails(true);
            try {
              setDetails(await getAdmittedStudentDetails(student.applicationId));
            } finally {
              setLoadingDetails(false);
            }
          }}
          aria-label="View student"
        >
          <Eye />
        </Button>
        <Button asChild variant="outline" size="icon-sm" aria-label="Edit student">
          <Link href={`/portal/admission/${student.applicationId}/edit`}>
            <Pencil />
          </Link>
        </Button>
      </div>

      {viewOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setViewOpen(false);
            }
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="view-student-dialog-title"
            tabIndex={-1}
            className="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-lg border border-border bg-background shadow-xl outline-none"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2
                  id="view-student-dialog-title"
                  className="text-base font-semibold text-foreground"
                >
                  View Student
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {student.firstName} {student.lastName}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setViewOpen(false)}
                aria-label="Close"
              >
                <X />
              </Button>
            </div>
            <div className="overflow-y-auto p-5">
              {details ? (
                <AdmissionReviewDetails
                  form={details.reviewForm}
                  showConsent={false}
                  className="max-h-none"
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {loadingDetails
                    ? "Loading student details..."
                    : "Student details are unavailable."}
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
