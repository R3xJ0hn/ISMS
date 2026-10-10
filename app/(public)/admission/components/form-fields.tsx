"use client";

import * as React from "react";
import type { HTMLInputTypeAttribute, ReactNode } from "react";

import { cn } from "@/lib/utils";

export const inputClass =
  "h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 transition placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

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
  value?: string;
  defaultValue?: string;
  onChange?: (field: T, value: string) => void;
  type?: HTMLInputTypeAttribute;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  hint?: string;
  disabled?: boolean;
  readOnly?: boolean;
  validationMessage?: string | false;
};

export function TextField<T extends string>({
  id,
  label,
  value,
  defaultValue,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
  required,
  hint,
  disabled,
  readOnly,
  validationMessage,
}: TextFieldProps<T>) {
  return (
    <Field id={id} label={label} required={required} hint={hint}>
      <input
        id={id}
        name={readOnly ? undefined : id}
        type={type}
        value={value}
        defaultValue={defaultValue}
        required={required}
        aria-required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        readOnly={readOnly}
        onChange={onChange ? (event) => {
            event.currentTarget.setCustomValidity("");
            onChange(id, event.target.value);
          } : undefined}
        onInvalid={onChange && validationMessage !== false ? (event) => {
            event.currentTarget.setCustomValidity(
              validationMessage ?? `Please provide ${label.toLowerCase()}.`
            );
          } : undefined}
        className={cn(
          inputClass,
          (disabled || readOnly) && "border-gray-200 bg-gray-100 text-gray-500",
          disabled && "cursor-not-allowed"
        )}
      />
    </Field>
  );
}

type SelectFieldProps<T extends string> = {
  id: T;
  label: string;
  value?: string;
  defaultValue?: string;
  onChange?: (field: T, value: string) => void;
  children: ReactNode;
  required?: boolean;
  hint?: string;
  disabled?: boolean;
  placeholder: string;
  validationMessage?: string;
};

export function SelectField<T extends string>({
  id,
  label,
  value,
  defaultValue,
  onChange,
  children,
  required,
  hint,
  disabled,
  placeholder,
  validationMessage,
}: SelectFieldProps<T>) {
  return (
    <Field id={id} label={label} required={required} hint={hint}>
      <select
        id={id}
        name={id}
        value={value}
        defaultValue={defaultValue}
        required={required}
        aria-required={required}
        disabled={disabled}
        onChange={onChange ? (event) => {
            event.currentTarget.setCustomValidity("");
            onChange(id, event.target.value);
          } : undefined}
        onInvalid={onChange ? (event) => {
            event.currentTarget.setCustomValidity(
              validationMessage ?? `Please select ${label.toLowerCase()}.`
            );
          } : undefined}
        className={cn(
          inputClass,
          disabled && "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-500"
        )}
      >
        <option value="" disabled={Boolean(onChange) || required} hidden={Boolean(onChange)}>
          {placeholder}
        </option>
        {children}
      </select>
    </Field>
  );
}

export type FormFieldDefinition<T extends string = string> = {
  id: T;
  label: string;
  type?: HTMLInputTypeAttribute;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  hint?: string;
  options?: readonly string[];
};

export function FormFields<T extends string>({
  fields,
  values,
  onChange,
}: {
  fields: readonly FormFieldDefinition<T>[];
  values: Record<T, string | null>;
  onChange?: (field: T, value: string) => void;
}) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {fields.map(({ options, ...field }) => {
        const props = {
          ...field,
          ...(onChange
            ? { value: values[field.id] ?? "", onChange }
            : { defaultValue: values[field.id] ?? "" }),
        };
        return options ? (
          <SelectField key={field.id} {...props} placeholder={field.placeholder ?? "Not specified"}>
            {options.map((option) => <option key={option} value={option}>{option}</option>)}
          </SelectField>
        ) : <TextField key={field.id} {...props} />;
      })}
    </div>
  );
}
