import type { HTMLInputTypeAttribute, ReactNode } from "react";

export type AdmissionFieldProps = {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
};

export type AdmissionTextFieldProps<T extends string> = {
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

export type AdmissionSelectFieldProps<T extends string> = {
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

export type AdmissionTextAreaFieldProps<T extends string> = {
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
