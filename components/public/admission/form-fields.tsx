"use client";

import * as React from "react";
import type { HTMLInputTypeAttribute, ReactNode } from "react";

import { cn } from "@/lib/utils";

export const inputClass =
  "h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 transition placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export const textareaClass =
  "min-h-28 w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 transition placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

type FieldProps = {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
};

function mergeAriaDescribedBy(
  currentValue: string | undefined,
  hintId: string
) {
  const ids = new Set([...(currentValue?.split(/\s+/) ?? []), hintId]);

  return [...ids].filter(Boolean).join(" ");
}

export function Field({ id, label, required, hint, children }: FieldProps) {
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

type TextFieldProps<T extends string> = {
  id: T;
  label: string;
  value: string;
  onChange: (field: T, value: string) => void;
  type?: HTMLInputTypeAttribute;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  hint?: string;
  disabled?: boolean;
};

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
}: TextFieldProps<T>) {
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

type SelectFieldProps<T extends string> = {
  id: T;
  label: string;
  value: string;
  onChange: (field: T, value: string) => void;
  children: ReactNode;
  required?: boolean;
  hint?: string;
  disabled?: boolean;
  placeholder: string;
};

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
}: SelectFieldProps<T>) {
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

type TextAreaFieldProps<T extends string> = {
  id: T;
  label: string;
  value: string;
  onChange: (field: T, value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  hint?: string;
  disabled?: boolean;
  rows?: number;
};

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
}: TextAreaFieldProps<T>) {
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
