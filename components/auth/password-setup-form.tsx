"use client";

import * as React from "react";

export type PasswordSetupFormState = {
  status: "idle" | "error";
  message: string;
};

type HiddenField = {
  name: string;
  value: string;
};

type AccountSummary = {
  name?: string;
  email?: string;
};

type PasswordSetupFormProps = {
  action: (
    previousState: PasswordSetupFormState,
    formData: FormData
  ) => Promise<PasswordSetupFormState>;
  initialState: PasswordSetupFormState;
  hiddenFields?: HiddenField[];
  eyebrow: string;
  title: string;
  description: React.ReactNode;
  account?: AccountSummary;
  submitLabel: string;
  pendingLabel: string;
};

const inputClass =
  "h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 transition placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label
        htmlFor={htmlFor}
        className="block text-sm font-semibold text-gray-800"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

export function PasswordSetupForm({
  action,
  initialState,
  hiddenFields = [],
  eyebrow,
  title,
  description,
  account,
  submitLabel,
  pendingLabel,
}: PasswordSetupFormProps) {
  const [state, formAction, pending] = React.useActionState(
    action,
    initialState
  );

  return (
    <form
      action={formAction}
      className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
    >
      {hiddenFields.map((field) => (
        <input
          key={field.name}
          type="hidden"
          name={field.name}
          value={field.value}
        />
      ))}

      <div className="border-b border-gray-200 px-5 py-5 sm:px-7">
        <p className="text-xs font-bold uppercase tracking-widest text-secondary">
          {eyebrow}
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-950">
          {title}
        </h1>
        <p className="mt-2 text-sm leading-6 text-gray-600">{description}</p>
      </div>

      <div className="space-y-5 px-5 py-6 sm:px-7">
        {account?.name || account?.email ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            {account.name ? (
              <p className="text-sm font-semibold text-gray-950">
                {account.name}
              </p>
            ) : null}
            {account.email ? (
              <p
                className={
                  account.name
                    ? "mt-1 text-sm text-gray-600"
                    : "text-sm text-gray-600"
                }
              >
                {account.email}
              </p>
            ) : null}
          </div>
        ) : null}

        <Field label="New password" htmlFor="password">
          <input
            id="password"
            name="password"
            type="password"
            minLength={8}
            required
            autoComplete="new-password"
            className={inputClass}
          />
        </Field>

        <Field label="Confirm password" htmlFor="confirmPassword">
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            minLength={8}
            required
            autoComplete="new-password"
            className={inputClass}
          />
        </Field>
      </div>

      <div className="flex flex-col gap-4 border-t border-gray-200 bg-gray-50 px-5 py-5 sm:px-7">
        {state.message ? (
          <p className="text-sm font-medium text-red-700">{state.message}</p>
        ) : null}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? pendingLabel : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
