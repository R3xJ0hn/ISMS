"use client";

import Link from "next/link";
import { Eye, Pencil, X } from "lucide-react";
import { useState } from "react";

import {
  AdmissionReviewDetails,
  type ReviewFormValues,
} from "@/app/(public)/admission/components/review-step";
import { Button } from "@/components/ui/button";

type PortalAdmittedStudentRecord = {
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

export function AdmittedStudentActions({
  student,
}: {
  student: PortalAdmittedStudentRecord;
}) {
  const [viewOpen, setViewOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={() => setViewOpen(true)}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-lg border border-border bg-background shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">
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
              <AdmissionReviewDetails
                form={student.reviewForm}
                showConsent={false}
                className="max-h-none"
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
