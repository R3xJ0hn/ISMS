"use client";

import * as React from "react";

const PROGRAMS = {
  college: ["BSIT", "ACT", "BSHM"],
  seniorHigh: ["STEM", "ABM", "HUMSS", "GAS", "ICT", "HE"],
} as const;

type YearRef = "" | "seniorHigh" | "college";

export default function HeroForm() {
  const [yearRef, setYearRef] = React.useState<YearRef>("");
  const [program, setProgram] = React.useState("");
  const [submitState, setSubmitState] = React.useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const programOptions: readonly string[] =
    yearRef === "college"
      ? PROGRAMS.college
      : yearRef === "seniorHigh"
      ? PROGRAMS.seniorHigh
      : [];

  function handleYearChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const nextYear = e.target.value as YearRef;
    setYearRef(nextYear);
    setProgram("");
    setSubmitState(null);
  }

  function handleProgramChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setProgram(e.target.value);
    setSubmitState(null);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!yearRef || !program) {
      setSubmitState({
        type: "error",
        message: "Please select both Year Reference and Program.",
      });
      return;
    }

    if (!programOptions.includes(program)) {
      setSubmitState({
        type: "error",
        message: "Please select a valid program for the selected Year Reference.",
      });
      return;
    }

    setSubmitState({
      type: "success",
      message: `Saved selection: ${yearRef === "college" ? "College" : "Senior High School"} - ${program}.`,
    });
  }

  return (
    <div className="bg-white rounded-xl shadow-xl p-8 max-w-md w-full mx-auto">
      <h2 className="text-2xl font-bold text-center text-primary">
        TAKE THE FIRST STEP
      </h2>

      <p className="text-sm text-gray-500 text-center mt-2">
        Request information to start on the path to your degree
      </p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <select
          value={yearRef}
          onChange={handleYearChange}
          className="w-full rounded-md border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">Year Reference</option>
          <option value="seniorHigh">Senior High School</option>
          <option value="college">College</option>
        </select>

        <select
          value={program}
          onChange={handleProgramChange}
          disabled={!yearRef}
          className="w-full rounded-md border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <option value="">
            {yearRef ? "Programs" : "Select Year Reference first"}
          </option>

          {programOptions.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <button
          type="submit"
          disabled={!yearRef || !program}
          className="w-full bg-primary text-white py-3 rounded-md font-semibold transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-primary"
        >
          Submit
        </button>
      </form>

      {submitState && (
        <p
          role="status"
          className={`mt-3 text-center text-xs ${submitState.type === "error" ? "text-red-600" : "text-green-700"}`}
        >
          {submitState.message}
        </p>
      )}

      <p className="text-xs text-gray-400 text-center mt-4">
        We respect your privacy.
      </p>
    </div>
  );
}
