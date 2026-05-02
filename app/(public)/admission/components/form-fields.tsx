"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import type {
  AdmissionFieldProps,
  AdmissionSelectFieldProps,
  AdmissionTextAreaFieldProps,
  AdmissionTextFieldProps,
} from "@/lib/types";

export const inputClass =
  "h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 transition placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export const textareaClass =
  "min-h-28 w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 transition placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

function mergeAriaDescribedBy(
  currentValue: string | undefined,
  hintId: string
) {
  const ids = new Set([...(currentValue?.split(/\s+/) ?? []), hintId]);

  return [...ids].filter(Boolean).join(" ");
}

export function Field({
  id,
  label,
  required,
  hint,
  children,
}: AdmissionFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const describedChild =
    hintId && React.isValidElement<{ "aria-describedby"?: string }>(children)
      ? React.cloneElement(children, {
          "aria-describedby": mergeAriaDescribedBy(
            children.props["aria-describedby"],
            hintId
          ),
        })
      : children;

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold text-gray-800">
        {label}
        {required ? <span className="text-secondary"> *</span> : null}
      </label>
      {describedChild}
      {hint ? (
        <p id={hintId} className="text-xs leading-5 text-gray-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function TextField<T extends string>({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
  required,
  hint,
  disabled,
}: AdmissionTextFieldProps<T>) {
  return (
    <Field id={id} label={label} required={required} hint={hint}>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        required={required}
        aria-required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        onChange={(event) => {
          event.currentTarget.setCustomValidity("");
          onChange(id, event.target.value);
        }}
        onInvalid={(event) => {
          event.currentTarget.setCustomValidity(
            `Please provide ${label.toLowerCase()}.`
          );
        }}
        className={cn(
          inputClass,
          disabled && "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-500"
        )}
      />
    </Field>
  );
}

export function SelectField<T extends string>({
  id,
  label,
  value,
  onChange,
  children,
  required,
  hint,
  disabled,
  placeholder,
}: AdmissionSelectFieldProps<T>) {
  return (
    <Field id={id} label={label} required={required} hint={hint}>
      <select
        id={id}
        name={id}
        value={value}
        required={required}
        aria-required={required}
        disabled={disabled}
        onChange={(event) => {
          event.currentTarget.setCustomValidity("");
          onChange(id, event.target.value);
        }}
        onInvalid={(event) => {
          event.currentTarget.setCustomValidity(
            `Please select ${label.toLowerCase()}.`
          );
        }}
        className={cn(
          inputClass,
          disabled && "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-500"
        )}
      >
        <option value="" disabled hidden>
          {placeholder}
        </option>
        {children}
      </select>
    </Field>
  );
}

export function TextAreaField<T extends string>({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  required,
  hint,
  disabled,
  rows = 4,
}: AdmissionTextAreaFieldProps<T>) {
  return (
    <Field id={id} label={label} required={required} hint={hint}>
      <textarea
        id={id}
        name={id}
        value={value}
        required={required}
        aria-required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        rows={rows}
        onChange={(event) => {
          event.currentTarget.setCustomValidity("");
          onChange(id, event.target.value);
        }}
        onInvalid={(event) => {
          event.currentTarget.setCustomValidity(
            `Please provide ${label.toLowerCase()}.`
          );
        }}
        className={cn(
          textareaClass,
          disabled && "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-500"
        )}
      />
    </Field>
  );
}
