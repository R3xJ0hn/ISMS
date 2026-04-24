"use client";

import * as React from "react";

import { LockKeyhole, UserRound } from "lucide-react";

import { loginAction, type LoginFormState } from "./actions";

const initialState: LoginFormState = {
  status: "idle",
  message: "",
  email: "",
};

export default function LoginForm() {
  const [state, formAction, pending] = React.useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <label className="block">
        <span className="text-sm font-bold text-gray-700">Email</span>
        <span className="mt-2 flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10">
          <UserRound className="size-5 text-gray-400" />
          <input
            type="email"
            name="email"
            required
            autoComplete="username"
            defaultValue={state.email}
            placeholder="Enter your email"
            className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
          />
        </span>
      </label>

      <label className="block">
        <span className="text-sm font-bold text-gray-700">Password</span>
        <span className="mt-2 flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10">
          <LockKeyhole className="size-5 text-gray-400" />
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            placeholder="Enter your password"
            className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
          />
        </span>
      </label>

      <div className="flex items-center justify-between gap-4 text-sm">
        <label className="flex items-center gap-2 text-gray-600">
          <input
            type="checkbox"
            name="rememberMe"
            className="size-4 rounded border-gray-300 accent-primary"
          />
          Remember me
        </label>
        <a className="font-semibold text-secondary" href="mailto:datamex_registrar@stadeline.edu.ph">
          Need help?
        </a>
      </div>

      {state.message ? (
        <p
          aria-live="polite"
          className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="w-full rounded-2xl bg-secondary px-5 py-3.5 text-sm font-black uppercase tracking-[0.18em] text-white shadow-lg shadow-secondary/20 transition hover:-translate-y-0.5 hover:bg-primary disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
