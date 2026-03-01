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

  const programOptions =
    yearRef === "college"
      ? PROGRAMS.college
      : yearRef === "seniorHigh"
      ? PROGRAMS.seniorHigh
      : [];

  function handleYearChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const nextYear = e.target.value as YearRef;
    setYearRef(nextYear);
    setProgram(""); // reset program when year changes
  }

  function handleProgramChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setProgram(e.target.value);
  }

  return (
    <div className="bg-white rounded-xl shadow-xl p-8 max-w-md w-full mx-auto">
      <h2 className="text-2xl font-bold text-center text-primary">
        TAKE THE FIRST STEP
      </h2>

      <p className="text-sm text-gray-500 text-center mt-2">
        Request information to start on the path to your degree
      </p>

      <form className="mt-6 space-y-4">
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
          className="w-full bg-primary text-white py-3 rounded-md font-semibold hover:bg-primary/90 transition"
        >
          Submit
        </button>
      </form>

      <p className="text-xs text-gray-400 text-center mt-4 flex items-center justify-center gap-1">
        🔒 We respect your privacy
      </p>
    </div>
  );
}