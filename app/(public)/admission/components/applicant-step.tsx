"use client";

import type { ReactNode } from "react";
import * as React from "react";
import Image from "next/image";
import { Check, Facebook, MapPin, Phone } from "lucide-react";

import { cn } from "@/lib/utils";
import type {
  AdmissionApplicantTypeOption,
  ApplicantBranch,
  ApplicantFieldName,
  ApplicantStepProps,
  BranchesStatus,
} from "@/lib/admission/types";
import { getAdmissionBranches } from "../actions";

const applicantTypes: AdmissionApplicantTypeOption[] = [
  {
    value: "New Student",
    title: "New student",
    description:
      "For applicants starting a new college record with Datamex College of Saint Adeline.",
  },
  {
    value: "Existing Student",
    title: "Existing student",
    description:
      "For currently or previously enrolled DCSA students",
  },
];

const selectClass =
  "h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";



function ChoiceButton({
  type,
  selected,
  onSelect,
}: {
  type: AdmissionApplicantTypeOption;
  selected: boolean;
  onSelect: (value: string) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(type.value)}
      className={cn(
        "min-h-32 rounded-lg border bg-white p-4 text-left transition hover:border-primary hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/25",
        selected
          ? "border-primary bg-primary/10 shadow-sm"
          : "border-gray-200"
      )}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="text-base font-semibold text-gray-950">
          {type.title}
        </span>
        <span
          className={cn(
            "grid size-6 shrink-0 place-items-center rounded-full border",
            selected
              ? "border-primary bg-primary text-white"
              : "border-gray-300 text-transparent"
          )}
        >
          <Check size={14} aria-hidden="true" />
        </span>
      </span>
      <span className="mt-3 block text-sm leading-6 text-gray-600">
        {type.description}
      </span>
    </button>
  );
}

function Field({
  id,
  label,
  required,
  hint,
  children,
}: {
  id: ApplicantFieldName;
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold text-gray-800">
        {label}
        {required && <span className="text-secondary"> *</span>}
      </label>
      {children}
      {hint && <p className="text-xs leading-5 text-gray-500">{hint}</p>}
    </div>
  );
}

function SelectField({
  id,
  label,
  value,
  onChange,
  branches,
  required,
  placeholder,
  disabled,
  hint,
}: {
  id: "branch_id";
  label: string;
  value: string;
  onChange: (field: ApplicantFieldName, value: string) => void;
  branches: ApplicantBranch[];
  required?: boolean;
  placeholder: string;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <Field id={id} label={label} required={required} hint={hint}>
      <select
        id={id}
        name={id}
        value={value}
        required={required}
        aria-required={required}
        onChange={(event) => {
          event.currentTarget.setCustomValidity("");
          const selectedBranch = branches.find(
            (branch) => branch.id === event.target.value
          );

          onChange(id, event.target.value);
          onChange("branch_code", selectedBranch?.code ?? "");
          onChange("branch_title", selectedBranch?.title ?? "");
        }}
        onInvalid={(event) => {
          event.currentTarget.setCustomValidity(`Please ${placeholder.toLowerCase()}.`);
        }}
        disabled={disabled}
        className={cn(
          selectClass,
          disabled && "cursor-not-allowed bg-gray-100 text-gray-500"
        )}
      >
        <option value="" disabled hidden>
          {placeholder}
        </option>
        {branches.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.title}
          </option>
        ))}
      </select>
    </Field>
  );
}

function DetailRow({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-2.5">
      <span className="mt-0.5 text-primary">{icon}</span>
      <div className="min-w-0">
        <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          {label}
        </dt>
        <dd className="mt-0.5 text-sm leading-5 text-gray-700">{children}</dd>
      </div>
    </div>
  );
}

function BranchDetails({
  branch,
  status,
}: {
  branch?: ApplicantBranch;
  status: BranchesStatus;
}) {
  if (status === "loading") {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm leading-5 text-gray-600">
        Loading branch details...
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm leading-5 text-red-700">
        Branch details are unavailable right now.
      </div>
    );
  }

  if (!branch) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm leading-5 text-gray-600">
        Select a branch to view its location and contact details.
      </div>
    );
  }

  const branchImage = branch.image?.trim();

  return (
    <div className="grid gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] lg:items-start">
      <div className="relative aspect-video overflow-hidden rounded-md bg-gray-100 lg:aspect-4/3">
        {branchImage ? (
          <Image
            src={branchImage}
            alt={branch.title}
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 56rem"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gray-100 px-4 text-center text-sm font-medium text-gray-500">
            Branch image unavailable
          </div>
        )}
      </div>

      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-widest text-primary">
          {branch.code}
        </p>
        <h4 className="mt-0.5 text-sm font-semibold text-gray-950">
          {branch.title}
        </h4>

        <dl className="mt-3 space-y-2.5">
          <DetailRow
            label="Address"
            icon={<MapPin size={16} aria-hidden="true" />}
          >
            {branch.mapLink ? (
              <a
                href={branch.mapLink}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                {branch.formattedAddress || "Address not provided"}
              </a>
            ) : (
              branch.formattedAddress || "Address not provided"
            )}
          </DetailRow>
          <DetailRow label="Phone" icon={<Phone size={16} aria-hidden="true" />}>
            {branch.phone || "Phone not provided"}
          </DetailRow>
          <DetailRow
            label="Facebook"
            icon={<Facebook size={16} aria-hidden="true" />}
          >
            {branch.facebookText || "Facebook page not provided"}
          </DetailRow>
        </dl>
      </div>
    </div>
  );
}

export default function ApplicantStep({ form, onChange }: ApplicantStepProps) {
  const [branches, setBranches] = React.useState<ApplicantBranch[]>([]);
  const [branchesStatus, setBranchesStatus] =
    React.useState<BranchesStatus>("loading");

  React.useEffect(() => {
    let cancelled = false;

    async function loadBranches() {
      try {
        setBranchesStatus("loading");

        const data = await getAdmissionBranches();

        if (cancelled) {
          return;
        }

        if (data.error) {
          throw new Error(data.error);
        }

        setBranches(data.branches);
        setBranchesStatus("success");
      } catch {
        if (!cancelled) {
          setBranches([]);
          setBranchesStatus("error");
        }
      }
    }

    void loadBranches();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedBranch = branches.find((branch) => branch.id === form.branch_id);
  const branchSelectDisabled = branchesStatus === "loading";
  const branchSelectHint =
    branchesStatus === "error"
      ? "Unable to load branches. Please try again later."
      : branchesStatus === "success" && branches.length === 0
        ? "No branches are available yet."
        : undefined;
  const branchSelectPlaceholder =
    branchesStatus === "loading" ? "Loading branches..." : "Select branch";

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-gray-950">
          Choose your applicant type
        </h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
          This helps the registrar prepare the right checklist and advising
          path.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {applicantTypes.map((type) => (
          <ChoiceButton
            key={type.value}
            type={type}
            selected={form.applicant_type === type.value}
            onSelect={(value) => onChange("applicant_type", value)}
          />
        ))}
      </div>

      <div className="grid gap-5">
        <SelectField
          id="branch_id"
          label="Preferred Branch"
          value={form.branch_id}
          onChange={onChange}
          required
          branches={branches}
          placeholder={branchSelectPlaceholder}
          disabled={branchSelectDisabled}
          hint={branchSelectHint}
        />
        <BranchDetails branch={selectedBranch} status={branchesStatus} />
      </div>
    </div>
  );
}
