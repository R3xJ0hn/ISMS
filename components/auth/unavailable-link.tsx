export function UnavailableLink({ kind }: { kind: "update" | "password" }) {
  const password = kind === "password";

  return (
    <div className="rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-red-700">
        Link unavailable
      </p>
      <h1 className="mt-2 text-2xl font-bold text-gray-950">
        {password
          ? "This password setup link is invalid or has expired."
          : "This update link is invalid or has expired."}
      </h1>
      <p className={`mt-3 text-sm leading-6 text-gray-600${password ? "" : " max-w-2xl"}`}>
        Return to the admission page and verify your current student record again
        to request a new {password ? "secure link" : "email link"}.
      </p>
    </div>
  );
}
