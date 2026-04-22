import { randomUUID } from "node:crypto";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdmissionSubmissionRequest = {
  form?: Record<string, unknown>;
  consent?: boolean;
};

const EXISTING_STUDENT = "Existing Student";
const NEW_STUDENT = "New Student";
const storagePath = path.join(
  process.cwd(),
  "data",
  "admission-submissions.jsonl"
);

const requiredFields = [
  "applicant_type",
  "branch_id",
  "student_first_name",
  "student_last_name",
  "student_birth_date",
  "student_gender",
  "student_civil_status",
  "student_citizenship",
  "student_birthplace",
  "contact_email",
  "contact_phone",
  "address_barangay",
  "address_city",
  "address_province",
  "last_school_name",
  "last_school_type",
  "last_school_barangay",
  "last_school_city",
  "last_school_province",
  "last_school_year",
  "last_school_year_level",
  "guardian_first_name",
  "guardian_last_name",
  "guardian_relationship",
  "guardian_contact_number",
] as const;

const existingStudentRequiredFields = [
  "current_student_number",
  "current_student_email",
  "current_student_first_name",
  "current_student_last_name",
  "current_student_birth_date",
  "current_last_school_year_attended",
  "current_student_record_id",
] as const;

const fieldLabels: Record<string, string> = {
  applicant_type: "Applicant type",
  branch_id: "Branch",
  student_first_name: "Student first name",
  student_last_name: "Student last name",
  student_birth_date: "Student birth date",
  student_gender: "Student gender",
  student_civil_status: "Student civil status",
  student_citizenship: "Student citizenship",
  student_birthplace: "Student birthplace",
  contact_email: "Contact email",
  contact_phone: "Contact phone",
  address_barangay: "Address barangay",
  address_city: "Address city",
  address_province: "Address province",
  last_school_name: "Last school name",
  last_school_type: "Last school type",
  last_school_barangay: "Last school barangay",
  last_school_city: "Last school city",
  last_school_province: "Last school province",
  last_school_year: "Last school year",
  last_school_year_level: "Last school year level",
  guardian_first_name: "Guardian first name",
  guardian_last_name: "Guardian last name",
  guardian_relationship: "Guardian relationship",
  guardian_contact_number: "Guardian contact number",
  current_student_number: "Current student number",
  current_student_email: "Current student email",
  current_student_first_name: "Current student first name",
  current_student_last_name: "Current student last name",
  current_student_birth_date: "Current student birth date",
  current_last_school_year_attended: "Last school year attended",
  current_student_record_id: "Verified student record",
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function missingRequiredField(
  form: Record<string, unknown>,
  fields: readonly string[]
) {
  return fields.find((field) => !normalizeText(form[field])) ?? null;
}

function normalizeForm(form: Record<string, unknown>) {
  const normalized: Record<string, string> = {};

  for (const [key, value] of Object.entries(form)) {
    normalized[key] = typeof value === "string" ? value : "";
  }

  return normalized;
}

export async function POST(request: Request) {
  let body: AdmissionSubmissionRequest;

  try {
    body = (await request.json()) as AdmissionSubmissionRequest;
  } catch {
    return NextResponse.json(
      {
        submitted: false,
        message: "Invalid request body.",
      },
      { status: 400 }
    );
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      {
        submitted: false,
        message: "Invalid admission submission payload.",
      },
      { status: 400 }
    );
  }

  const form =
    body.form && typeof body.form === "object" && !Array.isArray(body.form)
      ? body.form
      : null;

  if (!form) {
    return NextResponse.json(
      {
        submitted: false,
        message: "Admission form data is missing.",
      },
      { status: 400 }
    );
  }

  if (body.consent !== true) {
    return NextResponse.json(
      {
        submitted: false,
        message: "Review consent is required before submitting the form.",
      },
      { status: 400 }
    );
  }

  const applicantType = normalizeText(form.applicant_type);

  if (applicantType !== NEW_STUDENT && applicantType !== EXISTING_STUDENT) {
    return NextResponse.json(
      {
        submitted: false,
        message: "Select a valid applicant type before submitting.",
      },
      { status: 400 }
    );
  }

  const missingBaseField = missingRequiredField(form, requiredFields);

  if (missingBaseField) {
    return NextResponse.json(
      {
        submitted: false,
        message: `${fieldLabels[missingBaseField] ?? "A required field"} is required before submitting.`,
      },
      { status: 400 }
    );
  }

  if (applicantType === EXISTING_STUDENT) {
    const missingExistingField = missingRequiredField(
      form,
      existingStudentRequiredFields
    );

    if (missingExistingField) {
      return NextResponse.json(
        {
          submitted: false,
          message:
            missingExistingField === "current_student_record_id"
              ? "Verify your current student record before submitting."
              : `${fieldLabels[missingExistingField] ?? "A required field"} is required before submitting.`,
        },
        { status: 400 }
      );
    }
  }

  const submissionId = `ADM-${new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
  const submittedAt = new Date().toISOString();

  try {
    await mkdir(path.dirname(storagePath), { recursive: true });
    await appendFile(
      storagePath,
      `${JSON.stringify({
        submissionId,
        submittedAt,
        status: "submitted",
        consent: body.consent,
        form: normalizeForm(form),
      })}\n`,
      "utf8"
    );

    return NextResponse.json(
      {
        submitted: true,
        submissionId,
        submittedAt,
        message:
          "Your admission form has been submitted to the registrar for review.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to store admission submission:", error);

    return NextResponse.json(
      {
        submitted: false,
        message:
          "We could not save your admission form right now. Please try again.",
      },
      { status: 500 }
    );
  }
}
