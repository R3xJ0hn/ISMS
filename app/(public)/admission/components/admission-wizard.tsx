"use client";

import * as React from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Check,
  Download,
  FileCheck2,
  QrCode,
  Send,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type {
  AdmissionConfirmation,
  AdmissionFieldName,
  AdmissionFormValues,
  AdmissionStep as Step,
  AdmissionStepId as StepId,
  AdmissionSubmissionStatus,
  CurrentStudentFieldName,
  CurrentStudentStepHandle,
  CurrentStudentVerification,
  ExistingStudentNotice,
} from "@/lib/admission/types";
import { steps } from "./config";
import ApplicantStep from "./applicant-step";
import ContactStep from "./contact-step";
import CurrentStudentStep from "./current-student-step";
import GuardianStep from "./guardian-step";
import LastSchoolStep from "./last-school-step";
import ProgramStep from "./program-step";
import ReviewStep from "./review-step";
import StudentStep from "./student-step";
import { submitAdmissionApplication } from "../actions";

export const initialFormValues: AdmissionFormValues = {
  applicant_type: "",
  branch_id: "",
  branch_code: "",
  branch_title: "",
  program_type: "",
  program_id: "",
  program_code: "",
  program_label: "",
  academic_level_id: "",
  academic_level_label: "",
  student_first_name: "",
  student_last_name: "",
  student_middle_name: "",
  student_suffix: "",
  student_birth_date: "",
  student_gender: "",
  student_civil_status: "",
  student_citizenship: "",
  student_birthplace: "",
  student_religion: "",
  contact_email: "",
  contact_phone: "",
  contact_facebook: "",
  address_house_number: "",
  address_subdivision: "",
  address_street: "",
  address_barangay: "",
  address_city: "",
  address_province: "",
  address_postal_code: "",
  last_school_name: "",
  last_school_id: "",
  last_school_short_name: "",
  last_school_type: "",
  last_school_house_number: "",
  last_school_subdivision: "",
  last_school_street: "",
  last_school_barangay: "",
  last_school_city: "",
  last_school_province: "",
  last_school_postal_code: "",
  last_school_year: "",
  last_school_graduation_date: "",
  last_school_year_level: "",
  guardian_last_name: "",
  guardian_first_name: "",
  guardian_middle_name: "",
  guardian_suffix: "",
  guardian_relationship: "",
  guardian_contact_number: "",
  guardian_occupation: "",
  current_student_number: "",
  current_student_email: "",
  current_student_first_name: "",
  current_student_last_name: "",
  current_student_birth_date: "",
  current_student_record_id: "",
  current_student_verified_name: "",
  current_student_verified_school_year: "",
  current_student_verified_program: "",
  current_student_verified_branch: "",
  current_year_level: "",
  current_section: "",
  current_school_year: "",
};

const EXISTING_STUDENT = "Existing Student";
const REQUIRED_DOCUMENT_NOTE =
  "Bring a valid ID, report card or transcript, birth certificate, and latest 2x2 photo for manual review in the registrar office.";

const currentStudentInputFields = new Set<AdmissionFieldName>([
  "current_student_number",
  "current_student_email",
  "current_student_first_name",
  "current_student_last_name",
  "current_student_birth_date",
]);

function isCurrentStudentInputField(
  field: AdmissionFieldName
): field is CurrentStudentFieldName {
  return currentStudentInputFields.has(field);
}

function clearCurrentStudentVerification(form: AdmissionFormValues) {
  return {
    ...form,
    current_student_record_id: "",
    current_student_verified_name: "",
    current_student_verified_school_year: "",
    current_student_verified_program: "",
    current_student_verified_branch: "",
  };
}

function clearProgramSelection(form: AdmissionFormValues) {
  return {
    ...form,
    branch_code: "",
    branch_title: "",
    program_type: "",
    program_id: "",
    program_code: "",
    program_label: "",
    academic_level_id: "",
    academic_level_label: "",
  };
}

function getVisibleSteps(applicantType: string) {
  if (applicantType === EXISTING_STUDENT) {
    return steps.filter(
      (step) => step.id === "applicant" || step.id === "currentStudent"
    );
  }

  return steps.filter((step) => step.id !== "currentStudent");
}

function StepHeader({
  step,
  currentIndex,
  totalSteps,
}: {
  step: Step;
  currentIndex: number;
  totalSteps: number;
}) {
  const Icon = step.icon;

  return (
    <div className="border-b border-gray-200 px-5 py-5 sm:px-7">
      <p className="text-xs font-bold uppercase tracking-widest text-secondary">
        Step {currentIndex + 1} of {totalSteps} / {step.eyebrow}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Icon className="size-7 text-primary" aria-hidden="true" />
        <h2 className="text-2xl font-bold tracking-tight text-gray-950">
          {step.title}
        </h2>
      </div>
    </div>
  );
}

function stepIsComplete(
  stepId: StepId,
  form: AdmissionFormValues,
  consent: boolean
) {
  switch (stepId) {
    case "applicant":
      return Boolean(form.applicant_type && form.branch_id);
    case "program":
      return Boolean(
        form.program_type && form.program_id && form.academic_level_id
      );
    case "student":
      return Boolean(
        form.student_first_name &&
          form.student_last_name &&
          form.student_birth_date &&
          form.student_gender &&
          form.student_civil_status &&
          form.student_citizenship &&
          form.student_birthplace
      );
    case "contact":
      return Boolean(
        form.contact_email &&
          form.contact_phone &&
          form.address_barangay &&
          form.address_city &&
          form.address_province
      );
    case "lastSchool":
      return Boolean(
        form.last_school_name &&
          form.last_school_type &&
          form.last_school_barangay &&
          form.last_school_city &&
          form.last_school_province &&
          form.last_school_year &&
          form.last_school_year_level
      );
    case "guardian":
      return Boolean(
        form.guardian_first_name &&
          form.guardian_last_name &&
          form.guardian_relationship &&
          form.guardian_contact_number
      );
    case "currentStudent":
      if (form.applicant_type !== EXISTING_STUDENT) {
        return true;
      }

      return Boolean(
        form.current_student_number &&
          form.current_student_email &&
          form.current_student_first_name &&
          form.current_student_last_name &&
          form.current_student_birth_date &&
          form.current_student_record_id
      );
    case "review":
      return consent;
    default:
      return false;
  }
}

function currentStudentInputsComplete(form: AdmissionFormValues) {
  if (form.applicant_type !== EXISTING_STUDENT) {
    return true;
  }

  return Boolean(
    form.current_student_number &&
      form.current_student_email &&
      form.current_student_first_name &&
      form.current_student_last_name &&
      form.current_student_birth_date
  );
}

function firstIncompleteStepIndex(
  form: AdmissionFormValues,
  consent: boolean,
  visibleSteps: Step[]
) {
  return visibleSteps.findIndex(
    (step) => !stepIsComplete(step.id, form, consent)
  );
}

async function submitAdmission(
  form: AdmissionFormValues,
  consent: boolean
) {
  const data = await submitAdmissionApplication(form, consent);

  if (
    !data.submitted ||
    !data.submissionId ||
    !data.submittedAt
  ) {
    throw new Error(
      data.message ??
        "We could not submit your admission form right now. Please try again."
    );
  }

  return {
    message:
      data.message ??
      "Your admission form has been submitted to the registrar for review.",
    submissionId: data.submissionId,
    submittedAt: data.submittedAt,
  } satisfies AdmissionConfirmation;
}

function createQrModules(value: string) {
  const size = 21;
  const modules = Array.from({ length: size }, () => Array(size).fill(false));
  const reserved = Array.from({ length: size }, () => Array(size).fill(false));

  function set(row: number, column: number, dark: boolean, reserve = true) {
    if (row < 0 || row >= size || column < 0 || column >= size) {
      return;
    }

    modules[row][column] = dark;
    if (reserve) {
      reserved[row][column] = true;
    }
  }

  function finder(row: number, column: number) {
    for (let r = -1; r <= 7; r += 1) {
      for (let c = -1; c <= 7; c += 1) {
        const inOuter = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const inCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        set(row + r, column + c, inOuter && (r === 0 || r === 6 || c === 0 || c === 6 || inCenter));
      }
    }
  }

  finder(0, 0);
  finder(0, 14);
  finder(14, 0);

  for (let index = 8; index < 13; index += 1) {
    set(6, index, index % 2 === 0);
    set(index, 6, index % 2 === 0);
  }

  set(13, 8, true);

  for (let index = 0; index < 9; index += 1) {
    if (index !== 6) {
      reserved[8][index] = true;
      reserved[index][8] = true;
    }
  }

  for (let index = 0; index < 8; index += 1) {
    reserved[8][size - 1 - index] = true;
    reserved[size - 1 - index][8] = true;
  }

  const bits: number[] = [];
  const pushBits = (number: number, length: number) => {
    for (let index = length - 1; index >= 0; index -= 1) {
      bits.push((number >>> index) & 1);
    }
  };
  const digits = value.replace(/\D/g, "").slice(0, 8).padStart(8, "0");

  pushBits(0b0001, 4);
  pushBits(digits.length, 10);
  for (let index = 0; index < digits.length; index += 3) {
    const group = digits.slice(index, index + 3);
    pushBits(Number(group), group.length === 3 ? 10 : group.length === 2 ? 7 : 4);
  }
  pushBits(0, Math.min(4, 152 - bits.length));
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  const dataCodewords: number[] = [];
  for (let index = 0; index < bits.length; index += 8) {
    dataCodewords.push(Number.parseInt(bits.slice(index, index + 8).join(""), 2));
  }
  for (let index = 0; dataCodewords.length < 19; index += 1) {
    dataCodewords.push(index % 2 === 0 ? 0xec : 0x11);
  }

  const codewords = [...dataCodewords, ...createErrorCorrection(dataCodewords, 7)];
  const dataBits = codewords.flatMap((codeword) =>
    Array.from({ length: 8 }, (_, index) => (codeword >>> (7 - index)) & 1)
  );

  let bitIndex = 0;
  let direction = -1;

  for (let column = size - 1; column > 0; column -= 2) {
    if (column === 6) {
      column -= 1;
    }

    for (
      let row = direction === -1 ? size - 1 : 0;
      row >= 0 && row < size;
      row += direction
    ) {
      for (let offset = 0; offset < 2; offset += 1) {
        const currentColumn = column - offset;

        if (reserved[row][currentColumn]) {
          continue;
        }

        const maskedBit = (dataBits[bitIndex] ?? 0) === 1;
        modules[row][currentColumn] =
          (row + currentColumn) % 2 === 0 ? !maskedBit : maskedBit;
        bitIndex += 1;
      }
    }

    direction *= -1;
  }

  const formatBits = getFormatBits(0b01, 0);

  for (let index = 0; index <= 5; index += 1) {
    set(8, index, ((formatBits >> index) & 1) === 1);
  }
  set(8, 7, ((formatBits >> 6) & 1) === 1);
  set(8, 8, ((formatBits >> 7) & 1) === 1);
  set(7, 8, ((formatBits >> 8) & 1) === 1);
  for (let index = 9; index < 15; index += 1) {
    set(14 - index, 8, ((formatBits >> index) & 1) === 1);
  }
  for (let index = 0; index < 8; index += 1) {
    set(size - 1 - index, 8, ((formatBits >> index) & 1) === 1);
  }
  for (let index = 8; index < 15; index += 1) {
    set(8, size - 15 + index, ((formatBits >> index) & 1) === 1);
  }

  return modules;
}

function createErrorCorrection(data: number[], ecCodewords: number) {
  const generator = createGeneratorPolynomial(ecCodewords);
  const message = [...data, ...Array(ecCodewords).fill(0)];

  for (let index = 0; index < data.length; index += 1) {
    const coefficient = message[index];

    if (coefficient === 0) {
      continue;
    }

    for (let ecIndex = 0; ecIndex < generator.length; ecIndex += 1) {
      message[index + ecIndex] ^= gfMultiply(generator[ecIndex], coefficient);
    }
  }

  return message.slice(data.length);
}

function createGeneratorPolynomial(degree: number) {
  let generator = [1];

  for (let index = 0; index < degree; index += 1) {
    const next = Array(generator.length + 1).fill(0);

    generator.forEach((coefficient, coefficientIndex) => {
      next[coefficientIndex] ^= coefficient;
      next[coefficientIndex + 1] ^= gfMultiply(coefficient, gfPow(2, index));
    });
    generator = next;
  }

  return generator;
}

function gfPow(value: number, power: number) {
  let result = 1;

  for (let index = 0; index < power; index += 1) {
    result = gfMultiply(result, value);
  }

  return result;
}

function gfMultiply(left: number, right: number) {
  let product = 0;
  let multiplicand = left;
  let multiplier = right;

  while (multiplier > 0) {
    if (multiplier & 1) {
      product ^= multiplicand;
    }

    multiplicand <<= 1;
    if (multiplicand & 0x100) {
      multiplicand ^= 0x11d;
    }
    multiplier >>= 1;
  }

  return product;
}

function getFormatBits(errorCorrectionLevel: number, maskPattern: number) {
  const data = (errorCorrectionLevel << 3) | maskPattern;
  let bits = data << 10;

  for (let index = 14; index >= 10; index -= 1) {
    if ((bits >> index) & 1) {
      bits ^= 0x537 << (index - 10);
    }
  }

  return ((data << 10) | bits) ^ 0x5412;
}

function drawAdmissionSlip(
  canvas: HTMLCanvasElement,
  confirmation: AdmissionConfirmation
) {
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  const width = 900;
  const height = 1180;
  canvas.width = width;
  canvas.height = height;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#111827";
  context.font = "700 34px Arial";
  context.fillText("Admission Manual Review Slip", 60, 80);
  context.font = "400 20px Arial";
  context.fillStyle = "#4b5563";
  context.fillText("Present this slip at the registrar office for document checking.", 60, 118);
  context.fillStyle = "#f3f4f6";
  context.fillRect(60, 155, 780, 130);
  context.fillStyle = "#111827";
  context.font = "700 20px Arial";
  context.fillText("Submission reference", 90, 205);
  context.font = "700 54px Arial";
  context.fillText(confirmation.submissionId, 90, 260);
  context.font = "400 18px Arial";
  context.fillStyle = "#4b5563";
  context.fillText(`Submitted: ${new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(confirmation.submittedAt))}`, 470, 245);

  drawQr(context, confirmation.submissionId, 290, 340, 320);

  context.fillStyle = "#111827";
  context.font = "700 24px Arial";
  context.fillText("Bring these requirements", 60, 740);
  context.font = "400 22px Arial";
  const requirements = [
    "Valid ID",
    "Report card or transcript",
    "Birth certificate",
    "Latest 2x2 photo",
  ];
  requirements.forEach((requirement, index) => {
    context.fillText(`${index + 1}. ${requirement}`, 90, 790 + index * 42);
  });
  context.fillStyle = "#374151";
  context.font = "400 20px Arial";
  wrapCanvasText(context, REQUIRED_DOCUMENT_NOTE, 60, 1000, 760, 30);
}

function drawQr(
  context: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  size: number
) {
  const modules = createQrModules(value);
  const quiet = 4;
  const cell = size / (modules.length + quiet * 2);

  context.fillStyle = "#ffffff";
  context.fillRect(x, y, size, size);
  context.fillStyle = "#111827";
  modules.forEach((row, rowIndex) => {
    row.forEach((dark, columnIndex) => {
      if (dark) {
        context.fillRect(
          x + (columnIndex + quiet) * cell,
          y + (rowIndex + quiet) * cell,
          Math.ceil(cell),
          Math.ceil(cell)
        );
      }
    });
  });
}

function wrapCanvasText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const words = text.split(" ");
  let line = "";
  let currentY = y;

  words.forEach((word) => {
    const testLine = line ? `${line} ${word}` : word;

    if (context.measureText(testLine).width > maxWidth && line) {
      context.fillText(line, x, currentY);
      line = word;
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  });

  if (line) {
    context.fillText(line, x, currentY);
  }
}

function AdmissionConfirmationView({
  confirmation,
}: {
  confirmation: AdmissionConfirmation;
}) {
  const qrCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const slipCanvasRef = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    const qrCanvas = qrCanvasRef.current;
    const slipCanvas = slipCanvasRef.current;

    if (qrCanvas) {
      qrCanvas.width = 220;
      qrCanvas.height = 220;
      const context = qrCanvas.getContext("2d");

      if (context) {
        drawQr(context, confirmation.submissionId, 0, 0, 220);
      }
    }

    if (slipCanvas) {
      drawAdmissionSlip(slipCanvas, confirmation);
    }
  }, [confirmation]);

  function downloadSlip() {
    const canvas = slipCanvasRef.current;

    if (!canvas) {
      return;
    }

    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `admission-${confirmation.submissionId}.png`;
    link.click();
  }

  return (
    <div className="mx-auto flex h-full max-w-4xl items-center">
      <div className="w-full rounded-lg border border-emerald-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="grid size-11 shrink-0 place-items-center rounded-md bg-emerald-600 text-white">
            <FileCheck2 size={20} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Submission received
            </p>
            <h3 className="mt-1 text-2xl font-bold text-gray-950">
              Proceed to registrar manual review.
            </h3>
            <p className="mt-3 text-sm leading-6 text-gray-700">
              Your online admission form was received. Download or save the
              reference slip, then bring the listed documents to the registrar
              office for checking and next-step processing.
            </p>

            <dl className="mt-5 grid gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-semibold text-gray-600">
                  Submission reference
                </dt>
                <dd className="mt-1 font-mono text-3xl font-bold tracking-wider text-gray-950">
                  {confirmation.submissionId}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-gray-600">Submitted at</dt>
                <dd className="mt-1 text-gray-950">
                  {new Intl.DateTimeFormat("en-PH", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(confirmation.submittedAt))}
                </dd>
              </div>
            </dl>

            <div className="mt-5 rounded-lg border border-secondary/25 bg-secondary/5 p-4">
              <p className="text-sm font-semibold text-gray-950">
                Registrar office requirements
              </p>
              <p className="mt-2 text-sm leading-6 text-gray-700">
                {REQUIRED_DOCUMENT_NOTE}
              </p>
            </div>
          </div>

          <div className="w-full shrink-0 rounded-lg border border-gray-200 bg-white p-4 text-center lg:w-64">
            <div className="mx-auto grid size-10 place-items-center rounded-md bg-primary/10 text-primary">
              <QrCode size={18} aria-hidden="true" />
            </div>
            <canvas
              ref={qrCanvasRef}
              className="mx-auto mt-3 size-44"
              aria-label={`QR code for submission reference ${confirmation.submissionId}`}
            />
            <button
              type="button"
              onClick={downloadSlip}
              className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary/90"
            >
              <Download size={16} aria-hidden="true" />
              Download PNG
            </button>
            <canvas ref={slipCanvasRef} className="hidden" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdmissionWizard() {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [form, setForm] = React.useState<AdmissionFormValues>(
    () => ({ ...initialFormValues })
  );
  const [consent, setConsent] = React.useState(false);
  const [verifyingCurrentStudent, setVerifyingCurrentStudent] =
    React.useState(false);
  const [submissionStatus, setSubmissionStatus] =
    React.useState<AdmissionSubmissionStatus>("idle");
  const [submissionError, setSubmissionError] = React.useState("");
  const [confirmation, setConfirmation] =
    React.useState<AdmissionConfirmation | null>(null);
  const [existingStudentNotice, setExistingStudentNotice] =
    React.useState<ExistingStudentNotice | null>(null);
  const currentStudentStepRef =
    React.useRef<CurrentStudentStepHandle | null>(null);

  const existingStudentFlow = form.applicant_type === EXISTING_STUDENT;
  const visibleSteps = React.useMemo(
    () => getVisibleSteps(form.applicant_type),
    [form.applicant_type]
  );
  const safeCurrentIndex = Math.min(currentIndex, visibleSteps.length - 1);
  const currentStep = visibleSteps[safeCurrentIndex];
  const isFirstStep = safeCurrentIndex === 0;
  const isLastStep = safeCurrentIndex === visibleSteps.length - 1;
  const currentStepComplete = stepIsComplete(currentStep.id, form, consent);
  const showingExistingStudentNotice =
    existingStudentFlow && Boolean(existingStudentNotice);
  const currentStepReadyToContinue =
    showingExistingStudentNotice
      ? false
      : currentStep.id === "currentStudent"
      ? currentStudentInputsComplete(form)
      : currentStepComplete;
  const incompleteStepIndex = firstIncompleteStepIndex(
    form,
    consent,
    visibleSteps
  );
  const formComplete = incompleteStepIndex === -1;

  React.useEffect(() => {
    if (currentIndex !== safeCurrentIndex) {
      setCurrentIndex(safeCurrentIndex);
    }
  }, [currentIndex, safeCurrentIndex]);

  function canNavigateToStep(index: number) {
    if (index === safeCurrentIndex) {
      return true;
    }

    return visibleSteps
      .slice(0, index)
      .every((step) => stepIsComplete(step.id, form, consent));
  }

  function updateField(field: AdmissionFieldName, value: string) {
    setVerifyingCurrentStudent(false);
    setSubmissionError("");
    setConsent(false);
    setExistingStudentNotice(null);
    setForm((prev) => {
      const next = { ...prev, [field]: value };

      if (isCurrentStudentInputField(field)) {
        return clearCurrentStudentVerification(next);
      }

      if (field === "branch_id") {
        return clearProgramSelection(clearCurrentStudentVerification(next));
      }

      if (field === "applicant_type" && value !== EXISTING_STUDENT) {
        return clearCurrentStudentVerification(next);
      }

      return next;
    });
  }

  function handleCurrentStudentVerified(
    verification: CurrentStudentVerification
  ) {
    setConsent(false);
    setExistingStudentNotice({
      message:
        verification.message ??
        "Student record verified. Please check your email inbox or spam folder for the update link.",
    });
    setForm((prev) => ({
      ...prev,
      current_student_record_id: verification.recordId,
      current_student_verified_name: verification.displayName,
      current_student_verified_school_year: verification.schoolYear,
      current_student_verified_program: verification.program,
      current_student_verified_branch: verification.branch,
      contact_email: prev.contact_email || prev.current_student_email,
      student_first_name:
        prev.student_first_name || prev.current_student_first_name,
      student_last_name: prev.student_last_name || prev.current_student_last_name,
      student_birth_date:
        prev.student_birth_date || prev.current_student_birth_date,
    }));
  }

  function resetWizard() {
    setCurrentIndex(0);
    setForm({ ...initialFormValues });
    setConsent(false);
    setVerifyingCurrentStudent(false);
    setSubmissionStatus("idle");
    setSubmissionError("");
    setConfirmation(null);
    setExistingStudentNotice(null);
  }

  async function goNext() {
    const nextIndex = Math.min(safeCurrentIndex + 1, visibleSteps.length - 1);

    if (
      !currentStepReadyToContinue ||
      verifyingCurrentStudent ||
      submissionStatus === "submitting"
    ) {
      return;
    }

    if (currentStep.id === "currentStudent" && !form.current_student_record_id) {
      setVerifyingCurrentStudent(true);

      try {
        const verified = await currentStudentStepRef.current?.verify();

        if (!verified) {
          return;
        }
      } finally {
        setVerifyingCurrentStudent(false);
      }

      if (existingStudentFlow) {
        return;
      }
    }

    setCurrentIndex(nextIndex);
  }

  function goBack() {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmissionError("");

    if (existingStudentFlow) {
      if (!showingExistingStudentNotice) {
        await goNext();
      }
      return;
    }

    const invalidStepIndex = firstIncompleteStepIndex(
      form,
      consent,
      visibleSteps
    );

    if (invalidStepIndex !== -1) {
      setCurrentIndex(invalidStepIndex);
      setSubmissionError(
        "Complete the remaining admission steps before submitting your application."
      );
      return;
    }

    try {
      setSubmissionStatus("submitting");
      const result = await submitAdmission(form, consent);
      setConfirmation(result);
      setSubmissionStatus("submitted");
      setCurrentIndex(visibleSteps.length - 1);
    } catch (error) {
      setSubmissionStatus("idle");
      setSubmissionError(
        error instanceof Error
          ? error.message
          : "We could not submit your admission form right now. Please try again."
      );
    }
  }

  function renderStep() {
    switch (currentStep.id) {
      case "applicant":
        return <ApplicantStep form={form} onChange={updateField} />;
      case "program":
        return <ProgramStep form={form} onChange={updateField} />;
      case "student":
        return <StudentStep form={form} onChange={updateField} />;
      case "contact":
        return <ContactStep form={form} onChange={updateField} />;
      case "lastSchool":
        return <LastSchoolStep form={form} onChange={updateField} />;
      case "guardian":
        return <GuardianStep form={form} onChange={updateField} />;
      case "currentStudent":
        if (showingExistingStudentNotice && existingStudentNotice) {
          return (
            <div className="mx-auto flex h-full max-w-2xl items-center">
              <div className="w-full rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-600 text-white">
                    <Check size={18} aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
                      Record verified
                    </p>
                    <h3 className="mt-1 text-2xl font-bold text-gray-950">
                      Check your email for the update link.
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-gray-700">
                      {existingStudentNotice.message}
                    </p>
                    <p className="mt-4 text-sm leading-6 text-gray-600">
                      If you do not see the message right away, check your spam
                      or junk folder.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        }

        return (
          <CurrentStudentStep
            ref={currentStudentStepRef}
            form={form}
            onChange={updateField}
            onVerified={handleCurrentStudentVerified}
          />
        );
      case "review":
        return (
          <ReviewStep
            form={form}
            consent={consent}
            onConsentChange={setConsent}
          />
        );
      default:
        return null;
    }
  }

  return (
    <section id="admission-form" className="relative z-10 bg-gray-50 pb-16">
      <div className="mx-auto -mt-12 w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[290px_1fr]">
          <aside className="rounded-lg bg-white p-4 shadow-sm sm:border sm:border-gray-200 sm:p-0">
            <div className="sm:border-b sm:border-gray-200 sm:p-5">
              <div className="flex items-start justify-between gap-4 sm:block">
                <div>
                  <p className="text-sm font-semibold text-gray-500">
                    Admission progress
                  </p>
                  <p className="mt-1 text-lg font-bold text-gray-950 sm:mt-2 sm:text-2xl">
                    {safeCurrentIndex + 1}/{visibleSteps.length}
                  </p>
                </div>
                <p className="max-w-40 text-right text-sm font-semibold text-primary sm:hidden">
                  {currentStep.title}
                </p>
              </div>

              <div className="mt-4 sm:hidden">
                <div
                  className="h-1.5 overflow-hidden rounded-full bg-gray-200"
                  aria-hidden="true"
                >
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{
                      width: `${
                        ((safeCurrentIndex + 1) / visibleSteps.length) * 100
                      }%`,
                    }}
                  />
                </div>
                <ol
                  className="mt-3 flex items-center justify-between gap-1"
                  aria-label="Admission steps"
                >
                  {visibleSteps.map((step, index) => {
                    const active = index === safeCurrentIndex;
                    const complete = stepIsComplete(step.id, form, consent);

                    return (
                      <li
                        key={step.id}
                        className={cn(
                          "h-1.5 flex-1 rounded-full",
                          active || complete ? "bg-primary" : "bg-gray-200"
                        )}
                        aria-current={active ? "step" : undefined}
                      >
                        <span className="sr-only">
                          {step.label}
                          {active
                            ? ", current step"
                            : complete
                              ? ", complete"
                              : ""}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>

            <ol className="hidden gap-1 p-3 sm:grid">
              {visibleSteps.map((step, index) => {
                const Icon = step.icon;
                const active = index === safeCurrentIndex;
                const complete = stepIsComplete(step.id, form, consent);
                const canNavigate = canNavigateToStep(index);

                return (
                  <li key={step.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (canNavigate) {
                          setCurrentIndex(index);
                        }
                      }}
                      disabled={
                        !canNavigate ||
                        submissionStatus === "submitting" ||
                        Boolean(confirmation) ||
                        showingExistingStudentNotice
                      }
                      className={cn(
                        "flex min-h-14 w-full items-center gap-3 rounded-md px-3 py-2 text-left transition focus:outline-none focus:ring-2 focus:ring-primary/25",
                        active
                          ? "bg-primary text-white"
                          : canNavigate
                            ? "text-gray-700 hover:bg-gray-100"
                            : "cursor-not-allowed text-gray-400 opacity-70"
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-8 shrink-0 place-items-center rounded-md border",
                          active
                            ? "border-white/35 bg-white/15"
                            : complete
                              ? "border-primary bg-primary text-white"
                              : "border-gray-200 bg-white text-gray-500"
                        )}
                      >
                        {complete && !active ? (
                          <Check size={16} aria-hidden="true" />
                        ) : (
                          <Icon size={16} aria-hidden="true" />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">
                          {step.label}
                        </span>
                        <span
                          className={cn(
                            "block truncate text-xs",
                            active ? "text-white/80" : "text-gray-500"
                          )}
                        >
                          {step.eyebrow}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>

            <div className="hidden border-t border-gray-200 p-5 sm:block">
              <div className="flex items-start gap-3 text-sm leading-6 text-gray-600">
                <BookOpenCheck
                  className="mt-0.5 size-5 shrink-0 text-secondary"
                  aria-hidden="true"
                />
                <p>
                  Prepare a valid ID, report card or transcript, birth
                  certificate, and latest 2x2 photo before submission.
                </p>
              </div>
            </div>
          </aside>

          <form
            onSubmit={handleSubmit}
            className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
          >
            <StepHeader
              step={currentStep}
              currentIndex={safeCurrentIndex}
              totalSteps={visibleSteps.length}
            />

            <div className="min-h-140 px-5 py-6 sm:px-7">
              {confirmation ? (
                <AdmissionConfirmationView confirmation={confirmation} />
              ) : (
                renderStep()
              )}
            </div>

            <div className="flex flex-col gap-4 border-t border-gray-200 bg-gray-50 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
              {submissionError ? (
                <p className="text-sm font-medium text-red-700">
                  {submissionError}
                </p>
              ) : showingExistingStudentNotice ? (
                <p className="text-sm font-medium text-emerald-700">
                  Your record was verified. Check your email inbox or spam
                  folder for the secure update link.
                </p>
              ) : !confirmation && !currentStepComplete ? (
                <p className="text-sm font-medium text-secondary">
                  {currentStep.id === "currentStudent" &&
                  currentStudentInputsComplete(form)
                    ? "Continue will verify your student record before you can proceed."
                    : currentStep.id === "review"
                      ? "Review the application details and provide consent before submitting."
                      : "Complete the required fields to continue."}
                </p>
              ) : null}

              <div className="flex flex-col gap-3 sm:ml-auto sm:flex-row">
                <button
                  type="button"
                  onClick={confirmation || showingExistingStudentNotice ? resetWizard : goBack}
                  disabled={
                    submissionStatus === "submitting" ||
                    (!(confirmation || showingExistingStudentNotice) && isFirstStep)
                  }
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-5 text-sm font-semibold text-gray-800 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {confirmation || showingExistingStudentNotice ? (
                    <>
                      <ArrowLeft size={16} aria-hidden="true" />
                      Start another application
                    </>
                  ) : (
                    <>
                      <ArrowLeft size={16} aria-hidden="true" />
                      Back
                    </>
                  )}
                </button>

                {!confirmation && !showingExistingStudentNotice && !existingStudentFlow && isLastStep ? (
                  <button
                    type="submit"
                    disabled={!formComplete || submissionStatus === "submitting"}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-secondary px-5 text-sm font-semibold text-white transition hover:bg-secondary/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submissionStatus === "submitting"
                      ? "Submitting..."
                      : "Submit for Review"}
                    <Send size={16} aria-hidden="true" />
                  </button>
                ) : !confirmation ? (
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={
                      !currentStepReadyToContinue ||
                      verifyingCurrentStudent ||
                      submissionStatus === "submitting"
                    }
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {verifyingCurrentStudent ? "Verifying record..." : "Continue"}
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
